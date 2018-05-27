import racer from 'racer'
import model from './model'
import Tracker from 'trackerjs'

const util = racer.util

const Model = racer.Model

const DependencyManager = function () {
  this.deps = {}
}

DependencyManager.prototype.changed = function (deps) {
  if (deps['__dep']) {
    deps['__dep'].changed()
    delete deps['__dep']
  }
  const keys = Object.keys(deps)
  for (const key of keys) {
    this.changed(deps[key])
    delete deps[key]
  }
}

DependencyManager.prototype.find = function (segments) {
  let leaf = this.deps || {}
  if (!segments) return

  for (var i = 0, len = segments.length; i < len; i++) {
    const segment = segments[i]
    leaf[segment] = leaf[segment] || {}
    leaf = leaf[segment]
  }
  return leaf
}

DependencyManager.prototype.get = function (segments) {
  if (!Tracker.currentComputation) return

  const leaf = this.find(segments)

  if (!leaf.__dep) leaf.__dep = new Tracker.Dependency()
  leaf.__dep.depend()
}

DependencyManager.prototype.set = function (segments) {
  let leaf = this.deps || {}

  for (var i = 0, len = segments.length; i < len; i++) {
    const segment = segments[i]
    if (!leaf) break
    leaf = leaf[segment]
  }

  if (leaf) {
    this.changed(leaf)
  }
}

Model.prototype.deps = new DependencyManager()

Model.prototype._get = function (segments) {
  if (this.deps) this.deps.get(segments)
  return util.lookup(segments, this.root.data)
}

model.on('all', function fnListener (segments) {
  if (model.deps) model.deps.set(segments)
})

Tracker.once = function (name, context, dataFunc, updateFunc) {
  let data

  // Stop it just in case the autorun never re-ran
  if (context[name] && !context[name].stopped) context[name].stop()

  // NOTE: we may want to run this code in `setTimeout(func, 0)` so it doesn't impact the rendering phase at all
  context[name] = Tracker.nonreactive(() => {
    return Tracker.autorun(c => {
      if (c.firstRun) {
        data = dataFunc.call(context)
      } else {
        // Stop autorun here so rendering "phase" doesn't have extra work of also stopping autoruns; likely not too
        // important though.
        if (context[name]) context[name].stop()

        // where `forceUpdate` will be called in above implementation
        updateFunc.call(context)
      }
    })
  })

  return data
}
