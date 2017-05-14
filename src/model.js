import racer from 'racer'
import 'racer-highway/lib/browser/index.js'
let isServer = typeof window === 'undefined'

let bundle
let model

// TODO: Try how it works with big unload delay -- 10 seconds or so
const UNLOAD_DELAY = 100

if (!isServer) {
  let bundleElement = document.getElementById('bundle')
  bundle = JSON.parse((bundleElement && bundleElement.innerHTML))

  model = racer.createModel()

  // HACK: workaround for tests
  try {
    model.createConnection()
  } catch (err) {
    console.log(err)
  }

  if (bundle) model.unbundle(bundle)

  // Time before unsubscribe really does
  model.root.unloadDelay = UNLOAD_DELAY
}

export default model
