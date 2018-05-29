import model from '../model'
import Base from './Base'

const MAX_LISTENERS = 100

export default class Query extends Base {
  constructor (...args) {
    super(...args)
    let [collection, query] = this.params
    this.collection = collection
    this.query = query
  }

  async init () {
    await this._subscribe()
  }

  refModel () {
    let { key } = this
    this.query.ref(this.model.at(key))
    this.query.refIds(this.model.at(getIdsName(key)))
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
    delete this.query
    delete this.collection
    super.destroy()
  }
}

export function getIdsName (plural) {
  return plural.replace(/s$/i, '') + 'Ids'
}
