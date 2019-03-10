import Query from './Query'
import { observable } from '@nx-js/observer-util'
import { increment, decrement, UNSUBSCRIBE_DELAY } from '../counter'
import { getQuery, setQuery } from '../queriesMemo'

const MAX_LISTENERS = 100

export default class QueryExtra extends Query {
  getData () {
    let { collection, query } = this
    return getQuery(collection, query).getExtra()
  }

  async _subscribe () {
    return super._subscribe(true)
  }
}
