import model from '../model'
import Base from './Base'
import { observable } from '@nx-js/observer-util'

export default class Doc extends Base {
  constructor (...args) {
    super(...args)
    let [collection, docId] = this.params
    this.collection = collection
    this.docId = docId
    this.listeners = []
  }

  async init () {
    await this._subscribe()
  }

  refModel () {
    let { key } = this
    this.model.ref(key, this.subscription)
  }

  unrefModel () {
    let { key } = this
    this.model.removeRef(key)
  }

  async _subscribe () {
    let { collection, docId } = this
    this.subscription = model.scope(`${collection}.${docId}`)
    await new Promise((resolve, reject) => {
      model.subscribe(this.subscription, err => {
        if (err) return reject(err)
        let shareDoc = model.connection.get(collection, docId)
        shareDoc.data = observable(shareDoc.data)

        // Listen for doc creation, intercept it and make observable
        let createFn = () => {
          let shareDoc = model.connection.get(collection, docId)
          shareDoc.data = observable(shareDoc.data)
        }
        // Add listener to the top of the queue, since we want
        // to modify shareDoc.data before racer gets to it
        prependListener(shareDoc, 'create', createFn)
        this.listeners.push({
          ee: this.subscription.shareQuery,
          eventName: 'create',
          fn: createFn
        })
        resolve()
      })
    })
  }

  _clearListeners () {
    // remove query listeners
    for (let listener of this.listeners) {
      listener.ee.removeListener(listener.eventName, listener.fn)
    }
    delete this.listeners
  }

  _unsubscribe () {
    if (!this.subscription) return
    model.unsubscribe(this.subscription)
    delete this.subscription
  }

  destroy () {
    try {
      this._clearListeners()
      // this.unrefModel() // TODO: Maybe enable unref in future
      // TODO: Test what happens when trying to unsubscribe from not yet subscribed
      this._unsubscribe()
    } catch (err) {}
    delete this.docId
    delete this.collection
    super.destroy()
  }
}

// Shim for EventEmitter.prependListener.
// Right now this is required to support older build environments
// like react-native and webpack v1.
// TODO: Replace this with EventEmitter.prependListener in future
function prependListener (emitter, event, listener) {
  let old = emitter.listeners(event) || []
  emitter.removeAllListeners(event)
  let rv = emitter.on(event, listener)
  for (let i = 0, len = old.length; i < len; i++) {
    emitter.on(event, old[i])
  }
  return rv
}
