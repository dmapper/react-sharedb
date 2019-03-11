import Query from './Query'
import { observable } from '@nx-js/observer-util'
import { increment, decrement, UNSUBSCRIBE_DELAY } from '../counter'
import Subscriptions from '../Subscriptions'

const MAX_LISTENERS = 100

export default class QueryExtra extends Query {
  async _subscribe () {
    return super._subscribe(true)
  }
}
