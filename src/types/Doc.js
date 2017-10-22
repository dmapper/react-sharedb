import model from '../model'
import Base from './Base'
import DocListener from '../helpers/DocListener'

export default class Doc extends Base {

  constructor (...args) {
    super(...args)
    let [collection, docId] = this.params
    this.collection = collection
    this.docId = docId
  }

  async init () {
    await this._subscribe()
    // Can be destroyed while subscribe is still in progress
    if (this.destroyed) return
    this._listenForUpdates()
  }

  async _subscribe () {
    let {collection, docId} = this
    this.subscription = model.scope(`${collection}.${docId}`)
    await new Promise((resolve, reject) => {
      model.subscribe(this.subscription, err => {
        if (err) return reject(err)
        resolve()
      })
    })
  }

  _unsubscribe () {
    if (!this.subscription) return
    model.unsubscribe(this.subscription)
    delete this.subscription
  }

  _listenForUpdates () {
    let {collection, docId} = this
    this.docListener = new DocListener(collection, docId)
    this.docListener.on('update', () => this.emit('update'))
    this.docListener.init()
  }

  _clearListeners () {
    if (!this.docListener) return
    this.docListener.destroy()
    delete this.docListener
  }

  getData () {
    let {collection, docId, key} = this
    let value
    if (collection === 'texts') {
      value = model.connection.get('texts', docId)
      value = value && value.data
    } else {
      value = model.get(`${collection}.${docId}`)
    }
    return {[key]: value}
  }

  shouldForceUpdate () {
    return this.collection === 'texts'
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
