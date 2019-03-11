import { observable } from '@nx-js/observer-util'
import batching from './batching'
import EventEmitter from 'events'

export default class DocWrapper extends EventEmitter {
  constructor (connection, collection, docId) {
    super()
    this.connection = connection
    this.collection = collection
    this.docId = docId
    this.ready = undefined
    this.subscribe()
  }

  subscribe () {
    let { connection, collection, docId } = this
    this.shareDoc = connection.get(collection, docId)
    this.shareDoc.subscribe()
    this.shareDoc.on('load', this.onLoad)
  }

  onLoad = () => {
    this.init()
  }

  init () {
    this.ready = true
    this.shareDoc.data = observable(this.shareDoc.data)
    this.shareDoc.on('create', this.onCreate)
    this.emit('ready')
  }

  isReady () {
    return this.ready
  }

  getData () {
    return this.shareDoc.data
  }

  onCreate () {
    this.shareDoc.data = observable(this.shareDoc.data)
    this.emit('forceUpdate')
  }

  destroy () {
    this.removeAllListeners()
    if (this.ready) {
      this.shareDoc.removeListener('create', this.onCreate)
    }
    this.shareDoc.removeListener('load', this.onLoad)
    this.shareDoc.unsubscribe()
    delete this.shareDoc
    delete this.connection
  }
}
