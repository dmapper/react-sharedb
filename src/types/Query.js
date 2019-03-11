import model from '@react-sharedb/model'
import Base from './Base'
import { observable } from '@nx-js/observer-util'
import { observablePath, isExtraQuery } from '../util'
import Subscriptions, { TYPES } from '../Subscriptions'

export default class Query extends Base {
  constructor (...args) {
    super(...args)
    let [collection, queryParams] = this.params
    this.collection = collection
    this.queryParams = queryParams
  }

  async init () {
    await this._subscribe()
  }

  getData () {
    return Subscriptions.get(this.collection, this.queryParams).getData()
  }

  async _subscribe (isExtra) {
    this.subscribed = true
    await new Promise((resolve, reject) => {
      let sub = Subscriptions.init(
        TYPES.QUERY,
        this.connection,
        this.collection,
        this.queryParams,
        { isExtra }
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
    Subscriptions.destroy(this.collection, this.queryParams)
  }

  destroy () {
    try {
      // this.unrefModel() // TODO: Maybe enable unref in future
      // TODO: Test what happens when trying to unsubscribe from not yet subscribed
      this._unsubscribe()
    } catch (err) {}
    delete this.queryParams
    delete this.collection
    super.destroy()
  }
}
