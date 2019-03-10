export default class Base {
  constructor (connection, uniqId, params) {
    this.uniqId = uniqId
    this.params = params
    this.connection = connection
  }

  refModel () {}

  unrefModel () {}

  destroy () {
    this.cancel()
    delete this.connection
    delete this.params
    delete this.uniqId
  }

  // Cancel initialization process
  cancel () {
    // If model doesn't exist, it means that the item was already destroyed,
    // so no need to cancel
    if (!this.cancelled) this.cancelled = true
  }
}
