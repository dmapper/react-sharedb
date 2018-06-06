import model from '@react-sharedb/model'
import Base from './Base'
import { observablePath } from '../util'

export default class Local extends Base {
  constructor (...args) {
    super(...args)
    this.path = this.params
  }

  refModel () {
    let { key } = this
    observablePath(this.path)
    this.model.ref(key, model.scope(this.path))
  }

  unrefModel () {
    let { key } = this
    this.model.removeRef(key)
  }

  destroy () {
    // this.unrefModel() // TODO: Maybe enable unref in future
    delete this.path
    super.destroy()
  }
}
