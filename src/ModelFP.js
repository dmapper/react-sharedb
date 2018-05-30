// Functional Programming extension of Racer Model
import _ from 'lodash'
import racer from 'racer'
const Model = racer.Model

Model.prototype.atMap = function (subpath, fn) {
  if (typeof subpath === 'function') {
    fn = subpath
    subpath = undefined
  }
  let model = subpath ? this.at(subpath) : this
  let collection = model.get()
  return _.map(collection, (value, key) => fn(model.at(key)))
}

Model.prototype.atForEach = function (subpath, fn) {
  if (typeof subpath === 'function') {
    fn = subpath
    subpath = undefined
  }
  let model = subpath ? this.at(subpath) : this
  let collection = model.get()
  return _.forEach(collection, (value, key) => fn(model.at(key)))
}
