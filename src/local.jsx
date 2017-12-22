import model from './model'

const DEFAULT_COLLECTION = '$components'

export default function local (Component) {
  return function (Component) {
    let _componentWillMount = Component.prototype.componentWillMount
    Component.prototype.componentWillMount = function (...args) {
      this.model = generateScopedModel()
      if (_componentWillMount) _componentWillMount.call(this, ...args)
    }
    let _componentWillUnmount = Component.prototype.componentWillUnmount
    Component.prototype.componentWillUnmount = function (...args) {
      if (_componentWillUnmount) _componentWillUnmount.call(this, ...args)
      this.model.removeContextListeners()
      this.model.destroy()
      delete this.model
    }
    return Component
  }
}

function generateScopedModel () {
  let path = `${DEFAULT_COLLECTION}.${model.id()}`
  return model.scope(path)
}
