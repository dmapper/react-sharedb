import React, { useMemo, useLayoutEffect } from 'react'
import $root from '@react-sharedb/model'
import { useQuery } from './types'

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
