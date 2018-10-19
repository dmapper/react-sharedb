import _ from 'lodash'
import racer from 'racer'
import React from 'react'
import hoistStatics from 'hoist-non-react-statics'
import model from '@react-sharedb/model'
import Doc from './types/Doc'
import Query from './types/Query'
import QueryExtra from './types/QueryExtra'
import Local from './types/Local'
import Batching from './Batching'
import RacerLocalDoc from 'racer/lib/Model/LocalDoc'
import semaphore from './semaphore'
import {
  observe,
  unobserve,
  observable,
  isObservable
} from '@nx-js/observer-util'

const DEFAULT_COLLECTION = '$components'
const SUBSCRIBE_COMPUTATION_NAME = '__subscribeComputation'
const HELPER_METHODS_TO_BIND = ['get', 'at']
const DUMMY_STATE = {}
export const batching = new Batching()

export default function subscribe (fn) {
  return function decorateTarget (Component) {
    const isStateless = !(
      Component.prototype && Component.prototype.isReactComponent
    )
    let AutorunComponent = Component.__isSubscription
      ? Component
      : getAutorunComponent(Component, isStateless)
    let SubscriptionsContainer = getSubscriptionsContainer(
      AutorunComponent,
      fn ? [fn] : []
    )
    return hoistStatics(SubscriptionsContainer, AutorunComponent)
  }
}

const getAutorunComponent = (Component, isStateless) => {
  class AutorunHOC extends (isStateless ? React.Component : Component) {
    constructor (props, ...args) {
      super(props, ...args)

      // TODO: Remove this.scope alias.
      //       Since ComponentWillMount became deprecated
      //       we should not use this.scope alias anymore
      //       and do all the initialization in the constructor
      this.scope = props.scope

      // Mark subscription as used.
      // This is needed to track in later @subscribe's whether
      // to create a new $scope or use the one received from props
      // (in case when the outer component is @subscribe)
      props.$scope.__used = true

      // let fn = _.debounce(() => {
      //   if (this.unmounted) return
      //   this.setState(DUMMY_STATE)
      // })

      let updateFn = () => {
        if (this.unmounted) return
        this.setState(DUMMY_STATE)
      }
      this.update = () => batching.add(updateFn)

      // let fn = () => batchedUpdate(() => {
      //   if (this.unmounted) return
      //   this.setState(DUMMY_STATE)
      // })

      // create a reactive render for the component
      // run a dummy setState to schedule a new reactive render, avoid forceUpdate
      this.render = observe(this.render, {
        scheduler: this.update,
        lazy: true
      })
    }

    render () {
      return isStateless ? Component(this.props, this.context) : super.render()
    }

    componentWillUnmount () {
      this.unmounted = true
      // stop autorun
      unobserve(this.render)
      // call user defined componentWillUnmount
      if (super.componentWillUnmount) super.componentWillUnmount()
    }
  }
  AutorunHOC.displayName = `AutorunHOC(${Component.displayName ||
    Component.name ||
    'Component'})`
  return AutorunHOC
}

const getSubscriptionsContainer = (DecoratedComponent, fns) =>
  class SubscriptionsContainer extends React.Component {
    static __isSubscription = true

    componentWillMount () {
      this.model = this.getOrCreateModel()
      this.models = {}
      // pipe the local model into props as $scope
      this.models.$scope = this.model
      this.scope = this.model.get()
      this.autorunSubscriptions()
    }

    // TODO: Implement queueing
    async componentWillReceiveProps (...args) {
      let [nextProps] = args
      for (let dataFn of this.dataFns) {
        await dataFn(nextProps)
        if (this.unmounted) return
        if (this.doForceUpdate) {
          this.doForceUpdate = false
          this.setState(DUMMY_STATE)
        }
      }
    }

    // TODO: Maybe throw an error when passing used $scope to new @subscribe
    getOrCreateModel () {
      if (this.props.$scope && !this.props.$scope.__used) {
        return this.props.$scope
      } else {
        let model = generateScopedModel()
        semaphore.allowComponentSetter = true
        model.set('', observable({})) // Initially set empty object for observable
        semaphore.allowComponentSetter = false
        bindMethods(model, HELPER_METHODS_TO_BIND)
        return model
      }
    }

    componentWillUnmount () {
      this.unmounted = true

      // Stop all subscription params computations
      for (let index = 0; index < this.dataFns.length; index++) {
        let computationName = getComputationName(index)
        this.comps[computationName] && unobserve(this.comps[computationName])
        delete this.comps[computationName]
      }
      delete this.dataFns

      // Destroy whole model before destroying items one by one.
      // This prevents model.on() and model.start() from firing
      // extra times
      semaphore.allowComponentSetter = true
      this.model.destroy()
      semaphore.allowComponentSetter = false

      // Destroy all subscription items
      for (let key in this.items) {
        this.destroyItem(key, true, true)
      }

      delete this.models.$scope
      delete this.models
      delete this.scope
      delete this.model // delete the actual model
    }

    render () {
      this.rendered = true
      if (this.loaded) {
        return React.createElement(DecoratedComponent, {
          ...this.props,
          scope: this.scope,
          ...this.models,
          ref: (...args) => {
            if (!DecoratedComponent.__isSubscription) {
              if (this.props.innerRef) this.props.innerRef(...args)
            }
          }
        })
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

    // TODO: When we change subscription params quickly, we are going to
    //       receive a race condition when earlier subscription result might
    //       take longer to process compared to the same newer subscription.
    //       Implement Queue.
    async autorunSubscriptions () {
      this.items = {}
      this.comps = {}
      this.dataFns = []
      for (let index = 0; index < fns.length; index++) {
        let fn = fns[index]
        let subscriptions = {}
        let dataFn = async props => {
          // When there are multiple @subscribe's, the outermost
          // is going to destroy the model.
          // This check makes sure that inner @subscribe's don't
          // fire in that case.
          if (!this.model.get()) return

          let prevSubscriptions = subscriptions || {}
          let computationName = getComputationName(index)
          let subscribeFn = () => {
            subscriptions = fn.call(
              this,
              typeof props === 'function' ? this.props : props
            )
          }

          this.comps[computationName] && unobserve(this.comps[computationName])
          this.comps[computationName] = observe(subscribeFn, {
            scheduler: dataFn
          })

          let keys = _.union(_.keys(prevSubscriptions), _.keys(subscriptions))
          keys = _.uniq(keys)
          let promises = []
          batching.batch(() => {
            for (let key of keys) {
              if (!_.isEqual(subscriptions[key], prevSubscriptions[key])) {
                if (subscriptions[key]) {
                  promises.push(this.initItem(key, subscriptions[key]))
                } else {
                  this.destroyItem(key, true)
                }
              }
            }
          })
          await Promise.all(promises)
        }
        this.dataFns.push(dataFn)
        await dataFn(this.props)
        if (this.unmounted) return
      }
      // Reset force update since we are doing the initial rendering anyways
      this.doForceUpdate = false
      this.loaded = true
      // Sometimes all the subscriptions might go through synchronously
      // (for example if we are only subscribing to local data).
      // In this case we don't need to manually trigger update
      // since render will execute on its own later in the lifecycle.
      if (this.rendered) this.setState(DUMMY_STATE)
    }

    // TODO: Maybe implement queueing. Research if race condition is present.
    initItem (key, params) {
      let constructor = getItemConstructor(params)
      let item = new constructor(this.model, key, params)
      // We have to use promises directly here rather than async/await,
      // because we have to prevent async execution of init() if it is not present.
      // But defining the function as `async` will make it run in the next event loop.
      const finishInit = () => {
        if (this.unmounted) return item.destroy()
        batching.batch(() => {
          if (this.items[key]) this.destroyItem(key)
          item.refModel()
          this.items[key] = item
          // Expose scoped model under the same name with prepended $
          let keyModelName = getScopedModelName(key)
          if (!this.models[keyModelName]) {
            this.models[keyModelName] = this.model.at(key)
            this.doForceUpdate = true
          }
        })
      }
      if (item.init) {
        return item.init().then(finishInit)
      } else {
        finishInit()
        return Promise.resolve()
      }
    }

    // TODO: Refactor to use 3 different facade methods
    destroyItem (key, terminate, modelDestroyed) {
      if (!this.items[key]) return console.error('Trying to destroy', key)
      batching.batch(() => {
        if (!modelDestroyed) this.items[key].unrefModel()
        let keyModelName = getScopedModelName(key)
        if (terminate) {
          delete this[keyModelName]
          this.doForceUpdate = true
        }
        this.items[key].destroy()
      })
      delete this.items[key]
    }
  }

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

const BATCH_SETTERS = ['_mutate', '_setEach', '_setDiff', '_setDiffDeep']

for (let methodName of BATCH_SETTERS) {
  const oldMethod = racer.Model.prototype[methodName]
  racer.Model.prototype[methodName] = function () {
    let value
    batching.batch(() => {
      value = oldMethod.apply(this, arguments)
    })
    return value
  }
}

const WARNING_SETTERS = ['_set', '_setDiff', '_setNull', '_del']
for (let methodName of WARNING_SETTERS) {
  const oldMethod = racer.Model.prototype[methodName]
  racer.Model.prototype[methodName] = function (segments) {
    if (
      segments.length === 2 &&
      segments[0] === DEFAULT_COLLECTION &&
      !semaphore.allowComponentSetter
    ) {
      throw new Error(
        `You can't use '${methodName.replace(/^_/, '')}' on component's ` +
          `$scope root path. Use 'setEach' instead.`
      )
    }
    return oldMethod.apply(this, arguments)
  }
}

// Monkey patch racer's local documents to be observable
let oldUpdateCollectionData = RacerLocalDoc.prototype._updateCollectionData
RacerLocalDoc.prototype._updateCollectionData = function () {
  if (this.data) this.data = observable(this.data)
  if (!isObservable(this.collectionData)) {
    console.warn(
      `[react-sharedb] Local collection "${this
        .collectionName}" is not initialized to be observable. ` +
        `Run require("react-sharedb").initLocalCollection("${this
          .collectionName}") before using it anywhere. ` +
        `You must also do it right after cleaning it up with model.silent().destroy("${this
          .collectionName}")`
    )
  }
  return oldUpdateCollectionData.apply(this, arguments)
}
