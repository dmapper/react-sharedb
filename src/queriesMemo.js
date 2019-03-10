import QueryWrapper from './QueryWrapper'

let queries = {}

export function getQuery (collection, params) {
  if (typeof params !== 'string') params = JSON.stringify(params)
  if (queries[params]) return queries[params]
}

export function setQuery (collection, params, connection, shareQuery, isExtra) {
  if (typeof params !== 'string') params = JSON.stringify(params)
  if (queries[params]) queries[params].destroy()
  queries[params] = new QueryWrapper(connection, shareQuery, isExtra)
  return queries[params]
}

export function removeQuery (collection, params) {
  if (typeof params !== 'string') params = JSON.stringify(params)
  if (queries[params]) queries[params].destroy()
  delete queries[params]
}
