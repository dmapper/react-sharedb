import { observable } from '@nx-js/observer-util'
import batching from './batching'
import EventEmitter from 'events'

export default class DocWrapper extends EventEmitter {
  constructor (connection, shareDoc) {
    super()
    this.connection = connection
    this.shareDoc = shareDoc
    this.subscribed = undefined
  }

  init () {
    this.subscribed = true
    this.data = observable(this.shareDoc.data)
    this.shareDoc.on('create', this.onCreate)
    this.emit('init')
  }

  isSubscribed () {
    return this.subscribed
  }

  getData () {
    return this.data
  }

  onCreate () {
    this.shareDoc.data = observable(this.shareDoc.data)
    this.emit('forceUpdate')
  }

  destroy () {
    this.removeAllListeners()
    if (this.subscribed) {
      this.shareDoc.removeListener('create', this.onCreate)
      delete this.data
    }
    this.shareDoc.unsubscribe()
    delete this.shareDoc
    delete this.connection
  }
}
