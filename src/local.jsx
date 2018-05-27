import model from './model'
import Tracker from 'trackerjs'

const DEFAULT_COLLECTION = '$components'

export default function local (Component) {
  let _componentWillMount = Component.prototype.componentWillMount
  Component.prototype.componentWillMount = function (...args) {
    this.model = generateScopedModel()
    this.autorunRender()
    if (_componentWillMount) _componentWillMount.call(this, ...args)
  }
  let _componentWillUnmount = Component.prototype.componentWillUnmount
  Component.prototype.componentWillUnmount = function (...args) {
    if (_componentWillUnmount) _componentWillUnmount.call(this, ...args)
    this.model.destroy()
    delete this.model
  }
  Component.prototype.autorunRender = function () {
    let oldRender = this.render
    this.render = () => {
      // Simple method we can offer in the `Meteor.Component` API
      return this.autorunOnce('_renderComputation', oldRender)
    }
  }
  Component.prototype.autorunOnce = function (name, dataFunc) {
    return Tracker.once(name, this, dataFunc, this.forceUpdate)
  }
  return Component
}

function generateScopedModel () {
  let path = `${DEFAULT_COLLECTION}.${model.id()}`
  return model.scope(path)
}
