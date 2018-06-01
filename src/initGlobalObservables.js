import model from './model'
import { observable } from '@nx-js/observer-util'

const OBSERVABLE_COLLECTIONS = ['$components', '_page', '_session']

for (let collection of OBSERVABLE_COLLECTIONS) {
  model.set(`${collection}.__FOO`, 'hello')
  model.data[collection] = observable(model.data[collection])
  // model.del(`${collection}.__FOO`)
  // console.log('> DATA', model.data)
}
