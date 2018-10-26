import _ from 'lodash'
import { isExtraQuery } from './util'

export function subLocal (localPath) {
  if (typeof localPath !== 'string') {
    throw new Error(
      `[react-sharedb] subLocal(): localPath must be a String. Got: ${localPath}`
    )
  }
  return {
    __subscriptionType: 'Local',
    params: localPath
  }
}

export function subDoc (collection, docId) {
  let invalid
  if (typeof collection !== 'string') {
    throw new Error(
      `[react-sharedb] subDoc(): \`collection\` must be a String. Got: ${collection}`
    )
  }
  if (docId == null) {
    console.warn(`
      [react-sharedb] subDoc(): You are trying to subscribe to an undefined document id:
        ${collection}.${docId}
      Falling back to '__NULL__' document to prevent critical crash.
      You should prevent situations when the \`docId\` is undefined.  
    `)
    invalid = true
  }
  if (invalid) docId = '__NULL__'
  return {
    __subscriptionType: 'Doc',
    __subscriptionInvalid: invalid,
    params: [collection, docId]
  }
}

export function subQuery (collection, query) {
  let invalid
  if (typeof collection !== 'string') {
    throw new Error(
      `[react-sharedb] subQuery(): Collection must be String. Got: ${collection}`
    )
  }
  if (query == null) {
    console.warn(`
      [react-sharedb] subQuery(): Query is undefined. Got:
        ${collection}, ${query}
      Falling back to {_id: '__NON_EXISTENT__'} query to prevent critical crash.
      You should prevent situations when the \`query\` is undefined.  
    `)
    invalid = true
  }
  if (
    _.isString(query) ||
    _.isArray(query) ||
    _.isBoolean(query) ||
    _.isNumber(query)
  ) {
    throw new Error(`
      [react-sharedb] subQuery(): Query is not an Object. Got:
        ${collection}, ${query}      
      Query must always be an Object.
    `)
  }
  if (invalid) query = { _id: '__NON_EXISTENT__' }
  return {
    __subscriptionType: isExtraQuery(query) ? 'QueryExtra' : 'Query',
    __subscriptionInvalid: invalid,
    params: [collection, query]
  }
}

export function subValue (value) {
  return {
    __subscriptionType: 'Value',
    params: value
  }
}
