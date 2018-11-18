require('raf').polyfill(global)
global.DEBUG = process.env.DEBUG || process.env.debug
