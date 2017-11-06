import Query from './Query'

const MAX_LISTENERS = 100

export default class QueryExtra extends Query {
  _listenForUpdates () {
    let { subscription } = this
    this.listeners = []

    // Increase the listeners cap
    subscription.shareQuery.setMaxListeners(MAX_LISTENERS)

    // [update of the extra ($count, $aggregate)]
    let updateFn = () => this.emit('update')
    subscription.shareQuery.on('extra', updateFn)
    this.listeners.push({
      ee: subscription.shareQuery,
      eventName: 'extra',
      fn: updateFn
    })
  }

  _clearListeners () {
    if (!this.listeners) return
    // remove query listeners
    for (let listener of this.listeners) {
      listener.ee.removeListener(listener.eventName, listener.fn)
    }
    delete this.listeners
  }

  getData () {
    let { subscription, key } = this
    let value = subscription.getExtra()
    return { [key]: value }
  }
}
