import Query from './Query'
import { observable } from '@nx-js/observer-util'

const MAX_LISTENERS = 100

export default class QueryExtra extends Query {
  async _subscribe () {
    return super._subscribe(true)
  }
}
