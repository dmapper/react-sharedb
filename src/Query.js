import { observable } from '@nx-js/observer-util'
import batching from './batching'
import EventEmitter from 'events'

export default class Query extends EventEmitter {
  constructor (connection, collection, queryParams, { isExtra }) {
    super()
    this.connection = connection
    this.collection = collection
    this.queryParams = queryParams
    this.isExtra = isExtra
    this.ready = undefined
    this.subscribe()
  }

  subscribe () {
    let { connection, collection, queryParams } = this
    this.shareQuery = connection.createSubscribeQuery(collection, queryParams)
    this.shareQuery.on('ready', this.onReady)
  }

  onReady = () => {
    this.init()
  }

  init () {
    this.ready = true
    if (this.isExtra) {
      this.shareQuery.extra = observable(this.shareQuery.extra)
      this.shareQuery.on('extra', this.onExtra)
    } else {
      // observe initial docs
      for (let shareDoc of this.shareQuery.results) {
        shareDoc.data = observable(shareDoc.data)
      }
      this.results = observable(getDocsData(this.shareQuery.results))
      this.shareQuery.on('insert', this.onInsert)
      this.shareQuery.on('remove', this.onRemove)
      this.shareQuery.on('move', this.onMove)
    }
    this.emit('ready')
  }

  isReady () {
    return this.ready
  }

  getData () {
    if (this.isExtra) {
      return this.shareQuery.extra
    } else {
      return this.results
    }
  }

  onInsert = (shareDocs, index) => {
    // observe new docs
    for (let shareDoc of shareDocs) {
      shareDoc.data = observable(shareDoc.data)
    }
    batching.batch(() => {
      this.results.splice(index, 0, ...getDocsData(shareDocs))
    })
  }

  onRemove = (shareDocs, index) => {
    batching.batch(() => {
      this.results.splice(index, shareDocs.length)
    })
  }

  onMove = (shareDocs, from, to) => {
    batching.batch(() => {
      this.results.splice(from, shareDocs.length)
      this.results.splice(to, 0, ...getDocsData(shareDocs))
    })
  }

  onExtra = extra => {
    batching.batch(() => {
      // TODO: handle change of data to not modify the root value.
      //       Instead it should do a setDiffDeep for arrays/objects.
      //       It should also fire the forceUpdate if the data type
      //       is not array/object and when the data type changes.
      this.shareQuery.extra = observable(this.shareQuery.extra)
    })
  }

  destroy () {
    this.removeAllListeners()
    if (this.ready) {
      if (this.isExtra) {
        this.shareQuery.removeListener('extra', this.onExtra)
      } else {
        this.shareQuery.removeListener('insert', this.onInsert)
        this.shareQuery.removeListener('remove', this.onRemove)
        this.shareQuery.removeListener('move', this.onMove)
        delete this.results
      }
    }
    this.shareQuery.removeListener('ready', this.onReady)
    this.shareQuery.destroy()
    delete this.shareQuery
    delete this.connection
    delete this.collection
    delete this.queryParams
  }
}

function getShareResultsIds (results) {
  let ids = []
  for (let i = 0; i < results.length; i++) {
    let shareDoc = results[i]
    ids.push(shareDoc.id)
  }
  return ids
}

function getDocsData (shareDocs) {
  return shareDocs.map(shareDoc => shareDoc.data)
}
