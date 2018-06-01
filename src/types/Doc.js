import model from '../model'
import Base from './Base'
import { observable } from '@nx-js/observer-util'

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
        let shareDoc = model.connection.get(collection, docId)
        shareDoc.data = observable(shareDoc.data)
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
