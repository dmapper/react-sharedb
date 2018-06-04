import _ from 'lodash'
import React from 'react'
import hoistStatics from 'hoist-non-react-statics'
import model from './model'
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
  return function decorateTarget (Component) {
    const isStateless = !(
      Component.prototype && Component.prototype.isReactComponent
    )
    let AutorunComponent = getAutorunComponent(Component, isStateless)
    let SubscriptionsContainer = getSubscriptionsContainer(
      AutorunComponent,
      fns
    )
    return hoistStatics(SubscriptionsContainer, AutorunComponent)
  }
}

const getAutorunComponent = (Component, isStateless) =>
  class AutorunHOC extends (isStateless ? React.Component : Component) {
    constructor (props, ...args) {
      super(props, ...args)

      // TODO: Remove this.scope alias.
      //       Since ComponentWillMount became deprecated
      //       we should not use this.scope alias anymore
      //       and do all the initialization in the constructor
      this.scope = props.scope

      let fn = _.debounce(() => {
        if (this.unmounted) return
        this.setState(DUMMY_STATE)
      })

      // create a reactive render for the component
      // run a dummy setState to schedule a new reactive render, avoid forceUpdate
      this.render = observe(this.render, {
        scheduler: fn,
        lazy: true
      })
    }

    render () {
      return isStateless ? Component(this.props, this.context) : super.render()
    }

    componentWillUnmount () {
      this.unmounted = true
      // call user defined componentWillUnmount
      if (super.componentWillUnmount) super.componentWillUnmount()

      // stop autorun
      unobserve(this.render)
    }
  }

const getSubscriptionsContainer = (DecoratedComponent, fns) =>
  class SubscriptionsContainer extends React.Component {
    componentWillMount () {
      this.model = generateScopedModel()
      this.models = {}
      // pipe the local model into props as $scope
      this.models.$scope = this.model
      this.model.set('', observable({})) // Initially set empty object for observable
      this.scope = this.model.get()
      bindMethods(this.model, HELPER_METHODS_TO_BIND)
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

    componentWillUnmount () {
      this.unmounted = true
      // Stop render computation
      unobserve(this.render)
      // Stop all subscription params computations
      for (let index = 0; index < this.dataFns.length; index++) {
        let computationName = getComputationName(index)
        this.comps[computationName] && unobserve(this.comps[computationName])
        delete this.comps[computationName]
      }
      delete this.dataFns
      // Destroy all subscription items
      for (let key in this.items) {
        this.destroyItem(key, true)
      }
      delete this.models.$scope
      delete this.models
      delete this.scope
      this.model.destroy()
      delete this.model // delete the actual model
    }

    render () {
      this.rendered = true
      if (this.loaded) {
        return React.createElement(DecoratedComponent, {
          ...this.props,
          scope: this.scope,
          ...this.models
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
          let prevSubscriptions = subscriptions || {}
          let computationName = getComputationName(index)
          let subscribeFn = () => {
            subscriptions = fn.call(this, props)
          }
          this.comps[computationName] = observe(subscribeFn, {
            scheduler: dataFn
          })

          let keys = _.union(_.keys(prevSubscriptions), _.keys(subscriptions))
          keys = _.uniq(keys)
          let promises = []
          for (let key of keys) {
            if (!_.isEqual(subscriptions[key], prevSubscriptions[key])) {
              if (subscriptions[key]) {
                promises.push(await this.initItem(key, subscriptions[key]))
              } else {
                this.destroyItem(key, true)
              }
            }
          }
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
    async initItem (key, params) {
      let constructor = getItemConstructor(params)
      let item = new constructor(this.model, key, params)
      await item.init()
      if (this.unmounted) return item.destroy()
      if (this.items[key]) this.destroyItem(key)
      item.refModel()
      this.items[key] = item
      // Expose scoped model under the same name with prepended $
      let keyModelName = getScopedModelName(key)
      if (!this.models[keyModelName]) {
        this.models[keyModelName] = this.model.at(key)
        this.doForceUpdate = true
      }
    }

    destroyItem (key, terminate) {
      if (!this.items[key]) return console.error('Trying to destroy', key)
      this.items[key].unrefModel()
      let keyModelName = getScopedModelName(key)
      if (terminate) {
        delete this[keyModelName]
        this.doForceUpdate = true
      }
      this.items[key].destroy()
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
