import _ from 'lodash'
import EventEmitter from 'eventemitter3'
import { isModelKey } from '../subscribe'

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
      _.omitBy(data, (val, key) => isModelKey(key)),
      _.omitBy(prevData, (val, key) => isModelKey(key))
    )
  }

  shouldForceUpdate () {
    return false
  }

  destroy () {}
}
