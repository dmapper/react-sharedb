export default class Base {
  constructor (model, key, params) {
    this.key = key
    this.params = params
    this.model = model
  }

  async init () {}

  refModel () {}

  unrefModel () {}

  destroy () {
    delete this.model
    delete this.params
    delete this.key
  }
}
