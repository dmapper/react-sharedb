import racer from 'racer'
import Socket from 'racer-highway/lib/browser/socket'
let isServer = typeof window === 'undefined'
const DEFAULT_CLIENT_OPTIONS = {
  base: '/channel',
  reconnect: true,
  browserChannelOnly: false,
  srvProtocol: undefined,
  srvHost: undefined,
  srvPort: undefined,
  srvSecurePort: undefined,
  timeout: 10000,
  timeoutIncrement: 10000
}

racer.Model.prototype._createSocket = function (bundle) {
  let clientOptions =
    (typeof window !== 'undefined' && window.__racerHighwayClientOptions) ||
    DEFAULT_CLIENT_OPTIONS
  return new Socket(clientOptions)
}

let bundle
let model

// TODO: Try how it works with big unload delay -- 10 seconds or so
const UNLOAD_DELAY = 100

if (!isServer) {
  let bundleElement = document.getElementById('bundle')
  bundle = JSON.parse(bundleElement && bundleElement.innerHTML)

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
