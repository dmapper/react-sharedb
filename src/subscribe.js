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
    // also alias scoped model as $scope to be consistent
    // with the ${key} models for subscription items
    this.$scope = this.model
    this.model.set('', observable({})) // Initially set empty object for observable
    this.scope = this.model.get()
    bindMethods(this.model, HELPER_METHODS_TO_BIND)
    this.autorunRender()
    this.autorunSubscriptions()
    if (oldComponentWillMount) oldComponentWillMount.call(this, ...args)
    this.__ranComponentWillMount = true
    // run componentDidSubscribe custom lifecycle hook here if subscriptions
    // finished synchronously
    if (this.__loaded && this.componentDidSubscribe) {
      this.componentDidSubscribe()
    }
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
    for (let key in this.__items) {
      this.__destroyItem(key, true)
    }
    this.model.destroy()
    delete this.$scope // delete model alias
    delete this.model // delete the actual model
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
    let fn = _.debounce(() => {
      if (this.unmounted) return
      this.setState(DUMMY_STATE)
    })
    this.render = observe(loadingRenderWrapper, {
      scheduler: fn,
      lazy: true
    })
  },
  // TODO: When we change subscription params quickly, we are going to
  //       receive a race condition when earlier subscription result might
  //       take longer to process compared to the same newer subscription.
  //       Implement Queue.
  async autorunSubscriptions () {
    this.__items = {}
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
        let promises = []
        for (let key of keys) {
          if (!_.isEqual(subscriptions[key], prevSubscriptions[key])) {
            if (subscriptions[key]) {
              promises.push(await this.__initItem(key, subscriptions[key]))
            } else {
              this.__destroyItem(key, true)
            }
          }
        }
        await Promise.all(promises)
      }
      this.__dataFns.push(dataFn)
      await dataFn(this.props)
      if (this.unmounted) return
    }
    this.__loaded = true
    // run componentDidSubscribe custom lifecycle hook here if subscriptions
    // finished Asynchronously (after componentWillMount already executed)
    if (this.__ranComponentWillMount && this.componentDidSubscribe) {
      this.componentDidSubscribe()
    }
    // Sometimes all the subscriptions might go through synchronously
    // (for example if we are only subscribing to local data).
    // In this case we don't need to manually trigger forceUpdate
    // since render will execute on its own later in the lifecycle.
    if (this.__rendered) this.setState(DUMMY_STATE)
  },
  // TODO: Maybe implement queueing. Research if race condition is present.
  async __initItem (key, params) {
    let constructor = getItemConstructor(params)
    let item = new constructor(this.model, key, params)
    await item.init()
    if (this.unmounted) return item.destroy()
    if (this.__items[key]) this.__destroyItem(key)
    // Expose scoped model under the same name with prepended $
    let keyModelName = getScopedModelName(key)
    if (!this[keyModelName]) this[keyModelName] = this.model.at(key)
    item.refModel()
    this.__items[key] = item
  },
  __destroyItem (key, terminate) {
    if (!this.__items[key]) return console.error('Trying to destroy', key)
    this.__items[key].unrefModel()
    let keyModelName = getScopedModelName(key)
    if (terminate) delete this[keyModelName]
    this.__items[key].destroy()
    delete this.__items[key]
  },
  __removeItemRefs (key) {
    this.__items[key].unrefModel()
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

function getScopedModelName (key) {
  return `$${key}`
}
