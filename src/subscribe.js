import _ from 'lodash'
import React from 'react'
import model from './model'
import hoistStatics from 'hoist-non-react-statics'
import Doc from './types/Doc'
import Query from './types/Query'
import QueryExtra from './types/QueryExtra'
import Local from './types/Local'

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
    throw new Error(
      '[@subscribe] last argument (getSubscriptions) must be a function.'
    )
  }
  let reactiveProps = Array.prototype.slice.call(
    arguments,
    0,
    arguments.length - 1
  )
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
        this.init()
      }

      componentWillUnmount () {
        this.unmounted = true
        for (let key in this.items) {
          this.destroyItem(key)
        }
        delete this.items
      }

      // Update only after everything loaded
      shouldComponentUpdate (nextProps, nextState) {
        return !!this.loaded
      }

      getCurrentSubscriptions (props) {
        return (getSubscriptions && getSubscriptions(props)) || {}
      }

      // Update queries when reactiveProps change.
      // Right now it only supports changes to the existing queries.
      // TODO: Implement support for removing/adding queries
      componentWillReceiveProps (nextProps) {
        let updateQueries = reactiveProps.some(
          reactiveProp =>
            !_.isEqual(this.props[reactiveProp], nextProps[reactiveProp])
        )
        // FIXME: find new keys and init them
        // FIXME: find removed keys and destroy them (clear listeners, etc.)
        if (!updateQueries) return
        let prevSubscriptions = this.subscriptions
        this.subscriptions = this.getCurrentSubscriptions(nextProps)
        let keys = _.union(
          _.keys(prevSubscriptions),
          _.keys(this.subscriptions)
        )
        keys = _.uniq(keys)
        for (let key of keys) {
          if (!_.isEqual(this.subscriptions[key], prevSubscriptions[key])) {
            if (prevSubscriptions[key]) this.destroyItem(key)
            if (this.subscriptions[key]) {
              this.initItem(key)
            } else {
              // If the subscription was there before but now
              // it's gone, we should remove the item's data
              this.removeItemData(key)
            }
          }
        }
      }

      _isExtraQuery (queryParams) {
        return queryParams.$count || queryParams.$aggregate
      }

      async init () {
        this.items = {}
        this.itemKeys = {}
        for (let key in this.subscriptions) {
          let constructor = this.getItemConstructor(this.subscriptions[key])
          this.items[key] = new constructor(key, this.subscriptions[key])
        }
        // Init all items
        await Promise.all(_.map(this.items, i => i.init()))
        if (this.unmounted) return
        this.updateAllData()
        // Start listening for updates
        for (let key in this.items) {
          this.listenForItemUpdates(key)
        }
        this.loaded = true
        this.forceUpdate()
      }

      async initItem (key) {
        let constructor = this.getItemConstructor(this.subscriptions[key])
        this.items[key] = new constructor(key, this.subscriptions[key])
        await this.items[key].init()
        if (this.unmounted) return
        this.updateItemData(key)
        this.listenForItemUpdates(key)
      }

      destroyItem (key) {
        this.items[key].destroy()
        delete this.items[key]
      }

      getItemConstructor (subscription) {
        if (typeof subscription === 'string') return Local
        let [, params] = subscription
        return typeof params === 'string' || !params
          ? Doc
          : this._isExtraQuery(params) ? QueryExtra : Query
      }

      listenForItemUpdates (key) {
        this.items[key].on('update', this.updateItemData.bind(this, key))
      }

      updateAllData () {
        let data = {}
        _.reduce(
          this.items,
          (data, item, key) => {
            let itemData = item.getData()
            this.itemKeys[key] = _.keys(itemData)
            return _.merge(data, itemData)
          },
          data
        )
        this.setState(_.cloneDeep(data))
      }

      // Update item data and also remove any obsolete data
      // (old keys are tracked it itemKeys)
      updateItemData (key) {
        let data = this.items[key].getData()
        let oldItemKeys = this.itemKeys[key] || []
        let itemKeys = _.keys(data)
        this.itemKeys[key] = itemKeys
        let equal = this.items[key].isEqual(
          data,
          _.pick(this.state, oldItemKeys)
        )
        if (equal) return
        let removeValues = {}
        for (let itemKey of _.difference(oldItemKeys, itemKeys)) {
          _.merge(removeValues, { [itemKey]: null })
        }
        // TODO: remove log
        // console.log('--UPDATE', this.state, data)
        this.setState(_.merge(removeValues, _.cloneDeep(data)))
      }

      removeItemData (key) {
        let oldItemKeys = this.itemKeys[key] || []
        if (oldItemKeys.length === 0) return
        let removeValues = {}
        for (let itemKey of oldItemKeys) {
          _.merge(removeValues, { [itemKey]: null })
        }
        delete this.itemKeys[key]
        this.setState(removeValues)
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
          if (
            _.isPlainObject(newData) &&
            _.isPlainObject(this.state[key]) &&
            _.isEqual(
              _.omit(newData, IGNORE_FIELDS),
              _.omit(this.state[key], IGNORE_FIELDS)
            )
          ) {
            return
          }
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

      render () {
        return this.loaded
          ? React.createElement(DecoratedComponent, {
            ...this.props,
            ...this.state
          })
          : React.createElement('div', { className: 'Loading' })
      }
    }

    return hoistStatics(SubscriptionsContainer, DecoratedComponent)
  }
}
