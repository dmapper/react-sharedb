import model from '@react-sharedb/model'
import Base from './Base'
import { observable } from '@nx-js/observer-util'
import { observablePath, isExtraQuery } from '../util'
import { increment, decrement, UNSUBSCRIBE_DELAY } from '../counter'
import { getQuery, setQuery, removeQuery } from '../queriesMemo'

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

  getData () {
    let { collection, query } = this
    return getQuery(collection, query).getResults()
  }

  async _subscribe (isExtra) {
    let { connection, collection, query } = this
    let count = increment(collection, query)
    let hasAnotherSubscription = count > 1
    this.subscribed = true
    await new Promise((resolve, reject) => {
      if (hasAnotherSubscription) {
        let queryWrapper = getQuery(collection, query)
        if (queryWrapper.isSubscribed()) {
          resolve()
        } else {
          queryWrapper.on('init', resolve)
        }
      } else {
        let shareQuery = connection.createSubscribeQuery(
          collection,
          query,
          undefined,
          (err, results) => {
            console.log('> GOT result')
            // if (this.cancelled) return
            if (err) return reject(err)
            let queryWrapper = getQuery(collection, query)
            if (!queryWrapper) return
            queryWrapper.init()
          }
        )
        let queryWrapper = setQuery(
          collection,
          query,
          connection,
          shareQuery,
          isExtra
        )
        queryWrapper.on('init', resolve)
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
    let { collection, query } = this
    setTimeout(() => {
      // Unsubscribe only if there are no other active subscriptions
      if (decrement(collection, query)) return
      removeQuery(collection, query)
    }, UNSUBSCRIBE_DELAY)
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
