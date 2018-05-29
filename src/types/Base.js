import EventEmitter from 'eventemitter3'

export default class Base extends EventEmitter {
  constructor (model, key, params) {
    super()
    this.key = key
    this.params = params
    this.model = model
  }

  async init () {}

  refModel () {}

  unrefModel () {}

  destroy () {
    this.removeAllListeners()
    delete this.model
    delete this.params
    delete this.key
  }
}
