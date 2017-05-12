import _ from 'lodash'
import React from 'react'
import model from './model'
import hoistStatics from 'hoist-non-react-statics'

// Updates to the following fields are going to be ignored (props WON'T be updated)
const IGNORE_FIELDS = ['_meta', 'updatedAt', 'updatedBy']

// TODO: Explore the possibilities to optimize _.isEqual and _.clone
// http://stackoverflow.com/q/122102

/**
 * ShareDB subscriptions decorator.
 * @param [reactiveProp] {...string} - names of the props which trigger resubscribe
 *    Update subscription when any of them changes.
 * @param getSubscriptions {Function} - (props, state) Retrieve initial subscriptions data
 * @returns {Function}
 * @constructor
 * @example
 * |  @subscribe('toContentIds', 'fromContentIds', (props) => {
 * |    return {
 * |      template: ['templates', props.templateId],
 * |      sections: ['sections', { instructions: true, $sort: { createdAt: -1 } }],
 * |      toTexts: ['texts', { _id: { $in: props.toContentIds } }],
 * |      fromTexts: ['texts', { _id: { $in: props.fromContentIds } }]
 * |    }
 * |  })
 * @example Extra query (counting amount of documents)
 * |  @subscribe((props) => ({
 * |    contentsCount: ['contents', {
 * |      $count: true,
 * |      sectionId: props.sectionId
 * |    }]
 * |  }))
 */
export default function Subscribe () {
  let getSubscriptions = arguments[arguments.length - 1]
  if (typeof getSubscriptions !== 'function') {
    throw new Error('[@Subscribe] last argument (getSubscriptions) must be a function.')
  }
  let reactiveProps = Array.prototype.slice.call(arguments, 0, arguments.length - 1)
  if (reactiveProps.some(i => typeof i !== 'string')) {
    throw new Error('[@Subscribe] reactiveProps must be strings.')
  }
  return function decorateTarget (DecoratedComponent) {
    class SubscriptionsContainer extends React.Component {

      constructor (props) {
        super(props)
        this.subscriptions = this.getCurrentSubscriptions(props)
        this.state = {}
        this.listeners = {}
        this.subscribe()
      }

      componentWillUnmount () {
        this.unmounted = true
        for (let key in this.listeners) {
          let {ee, eventName, fn} = this.listeners[key]
          ee.removeListener(eventName, fn)
        }
        delete this.listeners
        model.unsubscribe(this.subscriptionsArray || [])
      }

      removeListener (key) {
        if (!this.listeners[key]) return
        let {ee, eventName, fn} = this.listeners[key]
        ee.removeListener(eventName, fn)
        delete this.listeners[key]
      }

      // Update only after everything loaded
      shouldComponentUpdate (nextProps, nextState) {
        return !!this.loaded
      }

      getCurrentSubscriptions (props) {
        return getSubscriptions && getSubscriptions(props) || {}
      }

      // Update queries when reactiveProps change.
      // Right now it only supports changes to the existing queries.
      // TODO: Implement support for removing/adding queries
      componentWillReceiveProps (nextProps) {
        let updateQueries = false
        reactiveProps.forEach((reactiveProp) => {
          if (!_.isEqual(this.props[reactiveProp], nextProps[reactiveProp])) {
            updateQueries = true
          }
        })
        // FIXME: find new keys and init them
        // FIXME: find removed keys and destroy them (clear listeners, etc.)
        if (updateQueries) {
          let prevSubscriptions = this.subscriptions
          this.subscriptions = this.getCurrentSubscriptions(nextProps)
          for (let key in this.subscriptions) {
            if (typeof this.subscriptions[key] === 'string') {
              let globalPath = this.subscriptions[key]
              let prevGlobalPath = prevSubscriptions[key]
              if (globalPath !== prevGlobalPath) {
                this.removeListener(key)
                this.initLocalData(key, globalPath)
              }
            } else {
              let [ collection, queryParams ] = this.subscriptions[ key ]
              // Update queries
              if (typeof queryParams === 'object') {
                let [ , prevQueryParams ] = prevSubscriptions[ key ]
                if (!_.isEqual(queryParams, prevQueryParams)) {
                  this.updateQuery(key, collection, queryParams)
                }
              // TODO: Implement update docs
              // For now, if you want a reactive doc subscription -
              // create a query { _id: props.myId }
              } else {
                // prevQueryParams here is a string
                let [ , prevQueryParams ] = prevSubscriptions[ key ]
                if (!_.isEqual(queryParams, prevQueryParams)) {
                  this.updateDoc(key, collection, queryParams)
                }
              }
            }
          }
        }
      }

      _isExtraQuery (queryParams) {
        return queryParams.$count || queryParams.$aggregate
      }

      subscribe () {
        let subscriptions = []
        let localModels = []
        for (let key in this.subscriptions) {
          if (typeof this.subscriptions[key] === 'string') {
            let globalPath = this.subscriptions[key]
            localModels.push({key, globalPath})
          } else {
            let [collection, queryParams] = this.subscriptions[key]
            if (typeof queryParams === 'string' || !queryParams) {
              subscriptions.push({
                key: key,
                doc: model.scope(`${collection}.${queryParams}`)
              })
            } else {
              subscriptions.push({
                key: key,
                query: model.query(collection, queryParams),
                isExtra: this._isExtraQuery(queryParams)
              })
            }
          }
        }
        this.subscriptionsArray = subscriptions.map(i => i.query || i.doc)
        model.subscribe(this.subscriptionsArray, (err) => {
          if (err) return console.error(err)
          if (this.unmounted) return model.unsubscribe(this.subscriptionsArray)
          subscriptions.forEach((subscription) => {
            if (subscription.doc) {
              this.initDocData(subscription.key, subscription.doc)
            } else if (subscription.query) {
              this.initQueryData(subscription.key, subscription.query,
                  subscription.isExtra)
            }
          })
          localModels.forEach(({key, globalPath}) => {
            this.initLocalData(key, globalPath)
          })
          this.loaded = true
          this.forceUpdate()
        })
      }

      initLocalData (key, globalPath) {
        this.updateLocalData(key, globalPath, true)
        let fn = () => this.updateLocalData(key, globalPath)
        this.listenGlobalPath(key, globalPath, fn)
      }

      listenGlobalPath (key, globalPath, fn) {
        let listener = model.on('all', globalPath + '.**', fn)
        this.listeners[key] = {
          ee: model,
          eventName: 'all',
          fn: listener
        }
      }

      /**
       * @param key
       * @param globalPath
       * @param updateModel -- force creation of new $model field
       */
      updateLocalData (key, globalPath, updateModel) {
        let update = false
        let newData = model.getDeepCopy(globalPath)
        // For public paths apply filter out the ignored fields
        if (/^[\$_]/.test(globalPath)) {
          if (_.isPlainObject(newData) && _.isPlainObject(this.state[key]) &&
              _.isEqual(_.omit(newData, IGNORE_FIELDS),
              _.omit(this.state[key], IGNORE_FIELDS))
          ) return
        }
        let newState = {}
        if (!_.isEqual(newData, this.state[key])) {
          update = true
          newState[key] = newData
        }
        if (updateModel) {
          update = true
          newState['$' + key] = model.scope(globalPath)
        }
        if (update) this.setState(newState)
      }

      initDocData (key, doc) {
        let [collection, docId] = doc.path().split('.')
        this.updateDocData(key, doc, collection, docId)
        let fn = () => this.updateDocData(key, doc, collection)
        this.listenDoc(collection, docId, key, fn)
      }

      listenDoc (collection, docId, key, fn) {
        let shareDoc = model.root.connection.get(collection, docId)
        if (!shareDoc) return console.error('Doc not found:', collection, docId)
        ;['op', 'del', 'create'].forEach((eventName) => {
          let handler = fn
          // Filter `op` ops to ignore changes to the IGNORE_FIELDS
          if (eventName === 'op') {
            handler = (op) => {
              if (_.isArray(op) && op[0] && op[0].p &&
                  IGNORE_FIELDS.indexOf(op[0].p[0]) !== -1) {
                return
              }
              fn()
            }
          }
          shareDoc.on(eventName, handler)
          let listenerName = `${collection}_${docId}_${key}_${eventName}`
          this.listeners[listenerName] = {
            ee: shareDoc,
            eventName: eventName,
            fn: handler
          }
        })
      }

      clearDocListeners (collection, docId, key) {
        ;['op', 'del', 'create'].forEach((eventName) => {
          let listenerName = `${collection}_${docId}_${key}_${eventName}`
          let {ee, fn} = this.listeners[listenerName]
          ee.removeListener(eventName, fn)
          delete this.listeners[listenerName]
        })
      }

      updateDocData = (key, doc, collection, docId) => {
        let update = false
        let newValues = {}
        docId = docId || doc.get('id')
        let value
        if (collection === 'texts') {
          value = model.root.connection.get('texts', docId)
          value = value && value.data
        } else {
          value = doc.get()
        }
        // FIXME: HACK 'texts' collection to always update since
        //        it's not properly syncronized with the racer model
        if (!_.isEqual(value, this.state[key])) {
          update = true
          // clone before setting
          newValues[key] = _.cloneDeep(value)
        }
        if (update) this.setState(newValues)
      }

      initQueryData (key, query, isExtra) {
        let updateFn = () => this.updateQueryData(key, query, isExtra)

        // Do the initial data update
        updateFn()

        // - Listen for changes to update query data

        // [update of query documents]
        let docIds = query.getIds()
        let collection = query.collectionName
        docIds.forEach((docId) => {
          this.listenDoc(collection, docId, key, updateFn)
        })

        // [insert]
        let insertFn = (shareDocs) => {
          // Update query data
          updateFn()
          // Start listening to changes to the new docs
          let ids = getShareResultsIds(shareDocs)
          ids.forEach((docId) => {
            this.listenDoc(collection, docId, key, updateFn)
          })
        }
        query.shareQuery.on('insert', insertFn)
        this.listeners[`${collection}_${key}_insert`] = {
          ee: query.shareQuery,
          eventName: 'insert',
          fn: insertFn
        }

        // [remove]
        let removeFn = (shareDocs) => {
          // Update query data
          updateFn()
          // Stop listening the removed docs
          let ids = getShareResultsIds(shareDocs)
          ids.forEach((docId) => {
            this.clearDocListeners(collection, docId, key)
          })
        }
        query.shareQuery.on('remove', removeFn)
        this.listeners[`${collection}_${key}_remove`] = {
          ee: query.shareQuery,
          eventName: 'remove',
          fn: removeFn
        }

        // [move] Do the regular update
        query.shareQuery.on('move', updateFn)
        this.listeners[`${collection}_${key}_move`] = {
          ee: query.shareQuery,
          eventName: 'move',
          fn: updateFn
        }

        // [update of the extra ($count, $aggregate)]
        query.shareQuery.on('extra', updateFn)
        this.listeners[`${collection}_${key}_extra`] = {
          ee: query.shareQuery,
          eventName: 'extra',
          fn: updateFn
        }
      }

      updateQuery (key, collection, newQuery) {
        let shareQuery = this._getShareQuery(key, collection)
        if (!shareQuery) return console.error('No share query found', key, collection)
        shareQuery.setQuery(newQuery)
      }

      // FIXME: Dummy function. Implement real updateDoc()
      updateDoc (key, collection, newId) {
        // TODO
      }

      // A little hacky way to get the sharedQuery from from
      // saved listeners
      _getShareQuery (key, collection) {
        let listener = this.listeners[`${collection}_${key}_insert`]
        return listener && listener.ee
      }

      updateQueryData (key, query, isExtra) {
        let update = false
        let newValues = {}
        // Handle `extra` query (can return anything)
        if (isExtra) {
          let value = query.getExtra()
          if (!_.isEqual(value, this.state[key])) {
            // Clone before writing
            newValues[key] = _.cloneDeep(value)
            update = true
          }
        // Handle normal query (sets array of documents and array of ids)
        } else {
          let ids = []
          let value = query.get().filter(doc => {
            if (doc) {
              ids.push(doc.id)
              return true
            } else {
              return false
            }
          })
          if (!_.isEqual(value, this.state[key])) {
            // Clone before writing
            newValues[key] = _.cloneDeep(value)
            update = true
          }
          let idsName = getIdsName(key)
          if (!_.isEqual(ids, this.state[idsName])) {
            newValues[idsName] = ids
            update = true
          }
        }
        if (update) this.setState(newValues)
      }

      render () {
        return (
          this.loaded
          ? React.createElement(DecoratedComponent, {...this.props, ...this.state})
          : React.createElement('div', {className: 'Loading'})
        )
      }

    }

    return hoistStatics(SubscriptionsContainer, DecoratedComponent)
  }
}

function getShareResultsIds (results) {
  let ids = []
  for (let i = 0; i < results.length; i++) {
    let shareDoc = results[i]
    ids.push(shareDoc.id)
  }
  return ids
}

function getIdsName (plural) {
  return plural.replace(/s$/i, '') + 'Ids'
}
