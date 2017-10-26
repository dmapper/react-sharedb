import _ from 'lodash'
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

  isEqual (data = {}, prevData = {}) {
    if (this.shouldForceUpdate()) return false
    return _.isEqual(
      // ignore keys which hold scoped models (starting with '$')
      _.omitBy(data, (val, key) => /^\$/.test(key)),
      _.omitBy(prevData, (val, key) => /^\$/.test(key))
    )
  }

  shouldForceUpdate () {
    return false
  }

  destroy () {}
}
