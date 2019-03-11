import Query from './Query'
import Doc from './Doc'

const UNSUBSCRIBE_DELAY = 3000

export const TYPES = {
  QUERY: 'query',
  DOC: 'doc'
}

const CLASSES = {
  [TYPES.QUERY]: Query,
  [TYPES.DOC]: Doc
}

class Subscriptions {
  subs = {}
  counter = {}

  get (collection, params) {
    let key = getKey(collection, params)
    return this.subs[key]
  }

  init (type, connection, collection, params, options) {
    let key = getKey(collection, params)
    this.counter[key] = (this.counter[key] || 0) + 1
    // Initialize only for the first subsciption
    if (this.counter[key] === 1) {
      if (this.subs[key]) this.subs[key].destroy()
      this.subs[key] = new CLASSES[type](
        connection,
        collection,
        params,
        options
      )
    }
    return this.subs[key]
  }

  destroy (collection, params) {
    let key = getKey(collection, params)
    setTimeout(() => {
      this._destroy(key)
    }, UNSUBSCRIBE_DELAY)
  }

  _destroy (key) {
    --this.counter[key]
    // Destroy only if the subscription is not used
    if (this.counter[key]) return
    if (this.subs[key]) this.subs[key].destroy()
    delete this.subs[key]
  }
}

function getKey (collection, params) {
  if (typeof params !== 'string') params = JSON.stringify(params)
  return collection + '_' + params
}

export default new Subscriptions()
