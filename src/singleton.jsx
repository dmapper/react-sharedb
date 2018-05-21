import model from './model'

const DEFAULT_COLLECTION = '$components'

export default function singleton (Component) {
  let model = generateScopedModel()
  Component.model = model
  Component.path = model.path.bind(model)
  let _componentWillUnmount = Component.prototype.componentWillUnmount
  Component.prototype.componentWillUnmount = function (...args) {
    if (_componentWillUnmount) _componentWillUnmount.call(this, ...args)
    model.destroy()
  }
  return Component
}

function generateScopedModel () {
  let path = `${DEFAULT_COLLECTION}.${model.id()}`
  return model.scope(path)
}
