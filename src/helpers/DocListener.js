import _ from 'lodash'
import EventEmitter from 'eventemitter3'
import model from '../model'

// Updates to the following fields are going to be ignored (props WON'T be updated)
const IGNORE_FIELDS = ['_meta', 'updatedAt', 'updatedBy']
const MAX_LISTENERS = 100

export default class DocListener extends EventEmitter {
  constructor (collection, docId) {
    super()
    this.collection = collection
    this.docId = docId
  }

  init () {
    let { collection, docId } = this
    let shareDoc = model.connection.get(collection, docId)
    if (!shareDoc) return console.error('Doc not found:', collection, docId)
    shareDoc.setMaxListeners(MAX_LISTENERS)
    this.listeners = []
    let fn = () => this.emit('update')
    ;['op', 'del', 'create'].forEach(eventName => {
      let handler = fn
      // Filter `op` ops to ignore changes to the IGNORE_FIELDS
      if (eventName === 'op') {
        handler = op => {
          if (
            _.isArray(op) &&
            op[0] &&
            op[0].p &&
            IGNORE_FIELDS.indexOf(op[0].p[0]) !== -1
          ) {
            return
          }
          fn()
        }
      }
      shareDoc.on(eventName, handler)
      this.listeners.push({
        ee: shareDoc,
        eventName,
        fn: handler
      })
    })
  }

  destroy () {
    this.removeAllListeners()
    if (!this.listeners) return
    for (let listener of this.listeners) {
      listener.ee.removeListener(listener.eventName, listener.fn)
    }
    delete this.listeners
  }
}
