import {
  useMemo,
  useEffect,
  useLayoutEffect,
  useState,
  useRef,
  useCallback
} from 'react'
import Doc from '../types/Doc'
import Query from '../types/Query'
import QueryExtra from '../types/QueryExtra'
import Local from '../types/Local'
import Value from '../types/Value'
import { batching } from '../subscribe'
import { subDoc, subLocal, subValue, subQuery } from '../subscriptionTypeFns'
import $root from '@react-sharedb/model'

const DEFAULT_COLLECTION = '$hooks'
const $collection = $root.scope(DEFAULT_COLLECTION)

export const useDoc = generateUseItemOfType(subDoc)
export const useQuery = generateUseItemOfType(subQuery)
export const useLocal = generateUseItemOfType(subLocal)
export const useValue = generateUseItemOfType(subValue)

function generateUseItemOfType (typeFn) {
  let isSync = typeFn === subLocal || typeFn === subValue
  return (...args) => {
    // TODO: Remove commented out force update
    // const forceUpdate = useForceUpdate()
    let $model = useMemo(() => generateScopedModel(), [])
    let hashedArgs = useMemo(() => JSON.stringify(args), args)

    const cancelInitRef = useRef()
    const destructorsRef = useRef([])
    const didMountRef = useRef(false)
    const didSyncInitRef = useRef(false)

    useUnmount(() => {
      if (cancelInitRef.current) cancelInitRef.current.value = true
      destructorsRef.current.forEach(destroy => destroy())
      destructorsRef.current.length = 0
      $model.destroy()
    })

    const initItem = useCallback(() => {
      // Cancel previous initialization if it is active
      if (cancelInitRef.current) cancelInitRef.current.value = true

      let params = typeFn(...args)

      let item = getItemFromParams(params, $model.leaf())
      let destroySelf = () => {
        item.unrefModel()
        item.destroy()
      }
      destructorsRef.current.push(destroySelf)

      let cancelInit = {}
      cancelInitRef.current = cancelInit

      const finishInit = () => {
        // If another initialization happened while we were waiting for init to finish, don't do anything
        if (cancelInit.value) return

        batching.batch(() => {
          // destroy the previous item and all unsuccessful item inits which happened until now.
          // Unsuccessful inits means the inits of those items which were cancelled, because
          // while the subscription was in process, another new item init started
          // (this might happen when the query parameter, like text search, changes quickly)
          // Don't destroy self though.
          destructorsRef.current.forEach(
            destroy => destroy !== destroySelf && destroy()
          )

          // Clear destructors array and add back self destroy
          destructorsRef.current.length = 0
          destructorsRef.current.push(destroySelf)

          // Reference the new item data
          item.refModel()

          // TODO: Remove commented out force update
          //       Force updating data seems to be not needed since the hook already
          //       returns the observed data which the observer had tracked access to.
          //       So the rerendering will happen automagically as soon as the .refModel()
          //       does its job and puts the data in.
          // Force update data
          // forceUpdate()
        })
      }

      if (isSync) {
        finishInit()
      } else {
        item.init().then(finishInit)
      }
    })

    // In case the data can be retrieved synchronously, get it right away
    if (isSync && !didSyncInitRef.current) {
      // We can't use didMountRef here since in future we might
      // change `useLayoutEffect` to `useEffect`.
      // And in concurrent react rendering mode this might lead to race conditions
      // (it's not clear whether it will lead to race condition or not, need to research it).
      // For now just use a separate ref to track this.
      didSyncInitRef.current = true
      initItem()
    }

    useLayoutEffect(
      () => {
        // In case the result was retrieved synchronously, don't init again
        if (isSync && !didMountRef.current) {
          didMountRef.current = true
          return
        }
        initItem()
      },
      [hashedArgs]
    )

    // Return data through the object key to let observer know that the data was accessed
    return [$collection.get()[$model.leaf()], $model]
  }
}

function getItemFromParams (params, key) {
  let explicitType = params && params.__subscriptionType
  let subscriptionParams = params.params
  let constructor = getItemConstructor(explicitType)
  return new constructor($collection, key, subscriptionParams)
}

function getItemConstructor (type) {
  switch (type) {
    case 'Local':
      return Local
    case 'Doc':
      return Doc
    case 'Query':
      return Query
    case 'QueryExtra':
      return QueryExtra
    case 'Value':
      return Value
    default:
      throw new Error('Unsupported subscription type: ' + type)
  }
}

function useUnmount (fn) {
  useLayoutEffect(() => fn, [])
}

function generateScopedModel () {
  let path = `${DEFAULT_COLLECTION}.${$root.id()}`
  return $root.scope(path)
}

// TODO: Remove commented out force update
function useForceUpdate () {
  const [tick, setTick] = useState(1)
  return () => {
    setTick(tick + 1)
  }
}
