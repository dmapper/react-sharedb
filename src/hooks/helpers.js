import React, { useMemo, useLayoutEffect } from 'react'
import $root from '@react-sharedb/model'

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
