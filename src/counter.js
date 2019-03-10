const ERROR_NOT_SUBSCRIBED =
  '[react-sharedb] ERROR! You have unsubscribed from doc/query you are not subscribed to:'

let counter = {}

export function increment (collection, params) {
  if (typeof params !== 'string') params = JSON.stringify(params)
  if (!counter[params]) counter[params] = 0
  return ++counter[params]
}

export function decrement (collection, params) {
  if (typeof params !== 'string') params = JSON.stringify(params)
  // Should never be less then 0. Show error if that does ever happen.
  if (!counter[params]) {
    console.error(ERROR_NOT_SUBSCRIBED, collection, params)
    return 0
  }
  return --counter[params]
}

export const UNSUBSCRIBE_DELAY = 3000
