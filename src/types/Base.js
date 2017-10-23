import EventEmitter from 'eventemitter3'

export default class Base extends EventEmitter {
  constructor (key, params) {
    super()
    this.key = key
    this.data = undefined
    this.ready = false
    this.params = params
  }

  async init () {}

  getData () {
    return undefined
  }

  shouldForceUpdate () {
    return false
  }

  destroy () {}
}
