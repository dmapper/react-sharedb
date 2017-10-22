import model from '../model'
import Base from './Base'
import DocListener from '../helpers/DocListener'

export default class Query extends Base {

  constructor (...args) {
    super(...args)
    let [collection, query] = this.params
    this.collection = collection
    this.query = query
  }

  async init () {
    await this._subscribe()
    // Can be destroyed while subscribe is still in progress
    if (this.destroyed) return
    this._listenForUpdates()
  }

  async _subscribe () {
    let {collection, query} = this
    this.subscription = model.query(collection, query)
    await new Promise(cb => model.subscribe(this.subscription, cb))()
  }

  _unsubscribe () {
    if (!this.subscription) return
    model.unsubscribe(this.subscription)
    delete this.subscription
  }

  _listenForUpdates () {
    let {collection, subscription} = this
    this.listens = true
    this.listeners = []
    this.docListeners = {}

    // - Listen for changes to update query data

    // [update of query documents]
    let docIds = subscription.getIds()
    for (let docId of docIds) {
      let docListener = new DocListener(collection, docId)
      this.docListeners.push(docListener)
      docListener.on('update', () => this.emit('update'))
      docListener.init()
    }

    // [insert]
    let insertFn = (shareDocs) => {
      // Start listening to changes to the new docs
      let ids = getShareResultsIds(shareDocs)
      ids.forEach(docId => {
        let docListener = new DocListener(collection, docId)
        this.docListeners.push(docListener)
        docListener.on('update', () => this.emit('update'))
        docListener.init()
      })
      this.emit('update')
    }
    subscription.shareQuery.on('insert', insertFn)
    this.listeners.push({
      ee: subscription.shareQuery,
      eventName: 'insert',
      fn: insertFn
    })

    // [remove]
    let removeFn = (shareDocs) => {
      // Stop listening the removed docs
      let ids = getShareResultsIds(shareDocs)
      ids.forEach(docId => {
        this.docListeners[docId].destroy()
        delete this.docListeners[docId]
      })
      this.emit('update')
    }
    subscription.shareQuery.on('remove', removeFn)
    this.listeners.push({
      ee: subscription.shareQuery,
      eventName: 'remove',
      fn: removeFn
    })

    // [move] Do the regular update
    let moveFn = () => this.emit('update')
    subscription.shareQuery.on('move', moveFn)
    this.listeners.push({
      ee: subscription.shareQuery,
      eventName: 'move',
      fn: moveFn
    })
  }

  _clearListeners () {
    if (!this.listens) return
    // remove query's docs listeners
    for (let docId in this.docListeners) {
      this.docListener[docId].destroy()
      delete this.docListener[docId]
    }
    // remove query listeners
    for (let listener of this.listeners) {
      listener.ee.removeListener(listener.eventName, listener.fn)
    }
    delete this.docListener
    delete this.listeners
    delete this.listens
  }

  getData () {
    let {subscription, key} = this
    let ids = []
    let value = subscription.get().filter(doc => {
      if (!doc) return
      ids.push(doc.id)
      return true
    })
    let idsName = getIdsName(key)
    return {
      [idsName]: ids,
      [key]: value
    }
  }

  destroy () {
    this.destroyed = true
    this.removeAllListeners()
    try {
      this._clearListeners()
      // TODO: Test what happens when trying to unsubscribe from not yet subscribed
      this._unsubscribe()
    } catch (err) {}
    delete this.params
    delete this.data
  }

}

export function getShareResultsIds (results) {
  let ids = []
  for (let i = 0; i < results.length; i++) {
    let shareDoc = results[i]
    ids.push(shareDoc.id)
  }
  return ids
}

export function getIdsName (plural) {
  return plural.replace(/s$/i, '') + 'Ids'
}
