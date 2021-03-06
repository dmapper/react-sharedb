import Base from './Base'
import { observablePath } from '../util'

export default class Local extends Base {
  constructor (...args) {
    super(...args)
    let [path, fn, inputs, options] = this.params
    this.path = path
    this.fn = fn
    this.inputs = inputs || []
    this.options = options || {}
    this.listeners = []
  }

  async init (firstItem) {
    await this._fetch(firstItem)
  }

  refModel () {
    if (this.cancelled) return
    let { key } = this
    if (this.path) {
      this.model.root.setDiff(this.path, this.data)
      observablePath(this.path)
      this.model.ref(key, this.model.root.scope(this.path))
    } else {
      this.model.setDiff(key, this.data)
    }
  }

  unrefModel () {
    let { key } = this
    if (this.path) {
      this.model.removeRef(key)
      this.model.root.del(this.path)
    } else {
      this.model.del(key)
    }
  }

  async _fetch (firstItem) {
    if (this.options.debounce && !firstItem) {
      await new Promise(resolve => setTimeout(resolve, this.options.debounce))
      if (this.cancelled) return
    }
    let promise = this.fn(...this.inputs)
    if (!(promise && typeof promise.then === 'function')) {
      throw new Error(`[react-sharedb] Api: fn must return promise`)
    }
    await promise.then(data => {
      if (this.cancelled) return
      this.data = data
    })
  }

  destroy () {
    // this.unrefModel() // TODO: Maybe enable unref in future
    delete this.path
    delete this.fn
    delete this.inputs
    delete this.options
    delete this.data
    super.destroy()
  }
}
