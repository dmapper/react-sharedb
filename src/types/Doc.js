import model from '@react-sharedb/model'
import Base from './Base'
import { observable } from '@nx-js/observer-util'
import { increment, decrement, UNSUBSCRIBE_DELAY } from '../counter'

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

  getData () {
    let { connection, collection, docId } = this
    return connection.get(collection, docId).data
  }

  async _subscribe () {
    let { connection, collection, docId } = this
    let shareDoc = connection.get(collection, docId)
    let count = increment(collection, docId)
    let hasAnotherSubscription = count > 1
    this.subscribed = true
    await new Promise((resolve, reject) => {
      // don't actually perform the subscription if we are already subscribed
      if (hasAnotherSubscription) {
        // TODO: wait until actually subscribed
        resolve()
      } else {
        shareDoc.subscribe(err => {
          // if (this.cancelled) return
          if (err) return reject(err)

          shareDoc.data = observable(shareDoc.data)

          // Listen for doc creation, intercept it and make observable
          let createFn = () => {
            let shareDoc = connection.get(collection, docId)
            shareDoc.data = observable(shareDoc.data)
          }
          // Add listener to the top of the queue, since we want
          // to modify shareDoc.data before racer gets to it
          shareDoc.on('create', createFn)
          this.listeners.push({
            ee: shareDoc,
            eventName: 'create',
            fn: createFn
          })
          resolve()
        })
      }
    })
  }

  _clearListeners () {
    // remove query listeners
    for (let listener of this.listeners) {
      listener.ee.removeListener(listener.eventName, listener.fn)
      delete listener.ee
      delete listener.fn
    }
    delete this.listeners
  }

  _unsubscribe () {
    if (!this.subscribed) return
    let { connection, collection, docId } = this
    setTimeout(() => {
      // Unsubscribe only if there are no other active subscriptions
      if (decrement(collection, docId)) return
      let shareDoc = connection.get(collection, docId)
      shareDoc.unsubscribe()
    }, UNSUBSCRIBE_DELAY)
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
