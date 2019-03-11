import model from '@react-sharedb/model'
import Base from './Base'
import { observable } from '@nx-js/observer-util'
import Subscriptions, { TYPES } from '../Subscriptions'

export default class Doc extends Base {
  constructor (...args) {
    super(...args)
    let [collection, docId] = this.params
    this.collection = collection
    this.docId = docId
  }

  async init () {
    await this._subscribe()
  }

  getData () {
    return Subscriptions.get(this.collection, this.docId).getData()
  }

  async _subscribe () {
    this.subscribed = true
    await new Promise((resolve, reject) => {
      let sub = Subscriptions.init(
        TYPES.DOC,
        this.connection,
        this.collection,
        this.docId
      )
      if (sub.isReady()) {
        resolve()
      } else {
        sub.on('ready', resolve)
        sub.on('error', reject)
      }
    })
  }

  _unsubscribe () {
    if (!this.subscribed) return
    Subscriptions.destroy(this.collection, this.docId)
  }

  destroy () {
    try {
      // this.unrefModel() // TODO: Maybe enable unref in future
      // TODO: Test what happens when trying to unsubscribe from not yet subscribed
      this._unsubscribe()
    } catch (err) {}
    delete this.docId
    delete this.collection
    super.destroy()
  }
}
