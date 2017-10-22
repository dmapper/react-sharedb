import _ from 'lodash'
import React from 'react'
import model from './model'
import hoistStatics from 'hoist-non-react-statics'
import Doc from './types/Doc'
import Query from './types/Query'
import QueryExtra from './types/QueryExtra'

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
export default function subscribe () {
  let getSubscriptions = arguments[arguments.length - 1]
  if (typeof getSubscriptions !== 'function') {
    throw new Error('[@subscribe] last argument (getSubscriptions) must be a function.')
  }
  let reactiveProps = Array.prototype.slice.call(arguments, 0, arguments.length - 1)
  if (reactiveProps.some(i => typeof i !== 'string')) {
    throw new Error('[@subscribe] reactiveProps must be strings.')
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
        for (let item of this.items) item.destroy()
        delete this.items
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
        return false
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

      async subscribe () {
        this.items = []
        for (let key in this.subscriptions) {
          let [, params] = this.subscriptions[key]
          let constructor = typeof params === 'string' || !params
            ? Doc
            : this._isExtraQuery(params)
            ? QueryExtra
            : Query
          this.items.push(new constructor(key, this.subscriptions[key]))
        }
        // Init all items
        await Promise.all(this.items.map(i => i.init()))
        if (this.unmounted) return
        // Update all data
        let data = {}
        this.items.reduce((data, item) => _.merge(data, item.getData()), data)
        this.setState(data)
        this.loaded = true
        this.forceUpdate()
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
