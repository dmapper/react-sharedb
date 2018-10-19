import { initLocalCollection } from './util'

const OBSERVABLE_COLLECTIONS = [
  '$connection',
  '$queries',
  '$components',
  '_page',
  '_session'
]

for (let collection of OBSERVABLE_COLLECTIONS) {
  initLocalCollection(collection)
}
