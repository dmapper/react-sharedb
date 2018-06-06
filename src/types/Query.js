import model from '@react-sharedb/model'
import Base from './Base'
import { observable } from '@nx-js/observer-util'
import { observablePath } from '../util'

const MAX_LISTENERS = 100

export default class Query extends Base {
  constructor (...args) {
    super(...args)
    let [collection, query] = this.params
    this.collection = collection
    this.query = query
    this.listeners = []
  }

  async init () {
    await this._subscribe()
  }

  refModel () {
    let { key } = this
    this.subscription.ref(this.model.at(key))
    observablePath(this.model.path(key))
    this.subscription.refIds(this.model.at(getIdsName(key)))
  }

  unrefModel () {
    let { key } = this
    this.model.removeRef(getIdsName(key))
    this.model.removeRef(key)
  }

  async _subscribe () {
    let { collection, query } = this
    this.subscription = model.query(collection, query)
    await new Promise((resolve, reject) => {
      model.subscribe(this.subscription, err => {
        if (err) return reject(err)
        // observe ids and extra
        let path = `$queries.${this.subscription.hash}`
        observablePath(path)

        // observe initial docs
        let docIds = this.subscription.getIds()
        for (let docId of docIds) {
          let shareDoc = model.connection.get(collection, docId)
          shareDoc.data = observable(shareDoc.data)
        }
        // Increase the listeners cap
        this.subscription.shareQuery.setMaxListeners(MAX_LISTENERS)

        // [insert]
        let insertFn = shareDocs => {
          // observe new docs
          let ids = getShareResultsIds(shareDocs)
          ids.forEach(docId => {
            let shareDoc = model.connection.get(collection, docId)
            shareDoc.data = observable(shareDoc.data)
          })
        }
        this.subscription.shareQuery.on('insert', insertFn)
        this.listeners.push({
          ee: this.subscription.shareQuery,
          eventName: 'insert',
          fn: insertFn
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
    // setTimeout(() => {
    //   console.log('>> unsubscribe')
    //   model.unsubscribe(subscription)
    // }, 3000)
    delete this.subscription
  }

  destroy () {
    try {
      this._clearListeners()
      // this.unrefModel() // TODO: Maybe enable unref in future
      // TODO: Test what happens when trying to unsubscribe from not yet subscribed
      this._unsubscribe()
    } catch (err) {}
    delete this.query
    delete this.collection
    super.destroy()
  }
}

export function getIdsName (plural) {
  return plural.replace(/s$/i, '') + 'Ids'
}

export function getShareResultsIds (results) {
  let ids = []
  for (let i = 0; i < results.length; i++) {
    let shareDoc = results[i]
    ids.push(shareDoc.id)
  }
  return ids
}
