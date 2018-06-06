import model from '@react-sharedb/model'
import { observable } from '@nx-js/observer-util'
import semaphore from './semaphore'

const OBSERVABLE_COLLECTIONS = ['$components', '_page', '_session']

for (let collection of OBSERVABLE_COLLECTIONS) {
  semaphore.allowComponentSetter = true
  model.set(`${collection}.__FOO`, 'hello')
  semaphore.allowComponentSetter = false
  model.data[collection] = observable(model.data[collection])
  // model.del(`${collection}.__FOO`)
  // console.log('> DATA', model.data)
}
