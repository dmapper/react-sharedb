import _ from 'lodash'
import React from 'react'
import model from './model'
import Tracker from 'trackerjs'
import Doc from './types/Doc'
import Query from './types/Query'
import QueryExtra from './types/QueryExtra'
import Local from './types/Local'
import {
  observe,
  unobserve,
  observable,
  isObservable
} from '@nx-js/observer-util'

const DEFAULT_COLLECTION = '$components'
const SUBSCRIBE_COMPUTATION_NAME = '__subscribeComputation'
const HELPER_METHODS_TO_BIND = ['get', 'at', 'atMap', 'atForEach']
const DUMMY_STATE = {}

export default function subscribe (...fns) {
  return function derorateTarget (Component) {
    Object.assign(
      Component.prototype,
      subscribeLocalMixin(
        fns,
        Component.prototype.componentWillMount,
        Component.prototype.componentWillUnmount,
        Component.prototype.componentWillReceiveProps
      )
    )
    return Component
  }
}

const subscribeLocalMixin = (
  fns,
  oldComponentWillMount,
  oldComponentWillUnmount,
  oldComponentWillReceiveProps
) => ({
  componentWillMount (...args) {
    this.model = generateScopedModel()
    this.model.set('', observable({})) // Initially set empty object for observable
    console.log('> is observable', isObservable(this.model.get()))
    console.log('> is observable hello', isObservable(this.model.get('hello')))
    bindMethods(this.model, HELPER_METHODS_TO_BIND)
    this.autorunRender()
    this.autorunSubscriptions()
    if (oldComponentWillMount) oldComponentWillMount.call(this, ...args)
  },
  // TODO: Implement queueing
  async componentWillReceiveProps (...args) {
    let [nextProps] = args
    for (let dataFn of this.__dataFns) {
      await dataFn(nextProps)
      if (this.unmounted) return
    }
    if (oldComponentWillReceiveProps) {
      oldComponentWillReceiveProps.call(this, ...args)
    }
  },
  componentWillUnmount (...args) {
    if (oldComponentWillUnmount) oldComponentWillUnmount.call(this, ...args)
    this.unmounted = true
    // Stop render computation
    unobserve(this.render)
    // Stop all subscription params computations
    for (let index = 0; index < this.__dataFns.length; index++) {
      let computationName = getComputationName(index)
      this[computationName] && this[computationName].stop()
      delete this[computationName]
    }
    delete this.__dataFns
    // Destroy all subscription items
    for (let key in this.items) {
      this.__destroyItem(key)
    }
    this.model.destroy()
    delete this.model
  },
  autorunRender () {
    let oldRender = this.render
    let loadingRenderWrapper = () => {
      this.__rendered = true
      if (this.__loaded) {
        return oldRender.call(this)
      } else {
        // When in React Native env, don't use any loading spinner
        if (
          typeof navigator !== 'undefined' &&
          navigator.product === 'ReactNative'
        ) {
          return null
        } else {
          return React.createElement('div', { className: 'Loading' })
        }
      }
    }
    this.render = observe(loadingRenderWrapper, {
      scheduler: () => this.setState(DUMMY_STATE),
      lazy: true
    })
  },
  // TODO: When we change subscription params quickly, we are going to
  //       receive a race condition when earlier subscription result might
  //       take longer to process compared to the same newer subscription.
  //       Implement Queue.
  async autorunSubscriptions () {
    this.items = {}
    this.__dataFns = []
    for (let index = 0; index < fns.length; index++) {
      let fn = fns[index]
      let subscriptions = {}
      let dataFn = async props => {
        let prevSubscriptions = subscriptions || {}
        let computationName = getComputationName(index)
        let subscribeFn = () => fn.call(this, props)
        subscriptions = Tracker.once(computationName, this, subscribeFn, dataFn)
        let keys = _.union(_.keys(prevSubscriptions), _.keys(subscriptions))
        keys = _.uniq(keys)
        for (let key of keys) {
          if (!_.isEqual(subscriptions[key], prevSubscriptions[key])) {
            // If the subscription was there before but now
            // it's gone, we should remove the item's data
            if (!subscriptions[key]) this.__removeItemRefs(key)
            if (prevSubscriptions[key]) this.__destroyItem(key)
            if (subscriptions[key]) {
              await this.__initItem(key, subscriptions[key])
            }
          }
        }
      }
      this.__dataFns.push(dataFn)
      await dataFn(this.props)
      if (this.unmounted) return
    }
    this.__loaded = true
    // Sometimes all the subscriptions might go through synchronously
    // (for example if we are only subscribing to local data).
    // In this case we don't need to manually trigger forceUpdate
    // since render will execute on its own later in the lifecycle.
    if (this.__rendered) this.setState(DUMMY_STATE)
  },
  async __initItem (key, params) {
    let constructor = getItemConstructor(params)
    let item = new constructor(this.model, key, params)
    await item.init()
    if (this.unmounted) return item.destroy()
    item.refModel()
    this.items[key] = item
  },
  __destroyItem (key) {
    this.items[key].unrefModel()
    this.items[key].destroy()
    delete this.items[key]
  },
  __removeItemRefs (key) {
    this.items[key].unrefModel()
  }
})

function generateScopedModel () {
  let path = `${DEFAULT_COLLECTION}.${model.id()}`
  return model.scope(path)
}

function isExtraQuery (queryParams) {
  return queryParams.$count || queryParams.$aggregate
}

function getItemConstructor (subscription) {
  if (typeof subscription === 'string') return Local
  let [, params] = subscription
  return typeof params === 'string' || !params
    ? Doc
    : isExtraQuery(params) ? QueryExtra : Query
}

function getComputationName (index) {
  return `${SUBSCRIBE_COMPUTATION_NAME}${index}`
}

function bindMethods (object, methodsToBind) {
  for (let method of methodsToBind) {
    object[method] = object[method].bind(object)
  }
}
