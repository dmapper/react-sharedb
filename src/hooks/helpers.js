import React, { useMemo, useLayoutEffect } from 'react'
import $root from '@react-sharedb/model'
import { useQuery, useLocal } from './types'

const boundEmit = $root.emit.bind($root)

export function useModel (...args) {
  return useMemo(() => $root.scope(...args), [...args])
}

export function useOn (...args) {
  useLayoutEffect(() => {
    let [eventName] = args
    let listener = $root.on(...args)
    return () => {
      $root.removeListener(eventName, listener)
    }
  })
}

export function useEmit () {
  return boundEmit
}

export function useQueryIds (collection, ids = []) {
  let [, $items, ready] = useQuery(collection, { _id: { $in: ids } })
  if (!ready) return [undefined, $items, ready]
  let items = ids.map(id => $root.get(`${collection}.${id}`)).filter(Boolean)
  return [items, $items, ready]
}

export function useLocalDoc (collection, docId) {
  if (typeof collection !== 'string') {
    throw new Error(
      `[react-sharedb] useLocalDoc(): \`collection\` must be a String. Got: ${collection}`
    )
  }
  if (!docId) {
    console.warn(`
      [react-sharedb] useLocalDoc(): You are trying to subscribe to an undefined document id:
        ${collection}.${docId}
      Falling back to '__NULL__' document to prevent critical crash.
      You should prevent situations when the \`docId\` is undefined.  
    `)
    docId = '__NULL__'
  }
  return useLocal(collection + '.' + docId)
}
