import { observable } from '@nx-js/observer-util'
import batching from './batching'
import EventEmitter from 'events'

export default class QueryWrapper extends EventEmitter {
  constructor (connection, shareQuery, isExtra) {
    super()
    this.connection = connection
    this.shareQuery = shareQuery
    this.isExtra = isExtra
    this.subscribed = undefined
  }

  init () {
    this.subscribed = true
    if (this.isExtra) {
      this.extra = observable(this.shareQuery.extra)
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
    this.emit('init')
  }

  isSubscribed () {
    return this.subscribed
  }

  getResults () {
    return this.results
  }

  getExtra () {
    return this.extra
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
    batching.batch(() => {})
  }

  destroy () {
    this.removeAllListeners()
    if (this.subscribed) {
      if (this.isExtra) {
        this.shareQuery.removeListener('insert', this.onInsert)
        this.shareQuery.removeListener('remove', this.onRemove)
        this.shareQuery.removeListener('move', this.onMove)
        delete this.results
      } else {
        this.shareQuery.removeListener('extra', this.onExtra)
        delete this.extra
      }
    }
    this.shareQuery.destroy()
    delete this.shareQuery
    delete this.connection
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
