import {
  useMemo,
  useEffect,
  useLayoutEffect,
  useState,
  useRef,
  useCallback
} from 'react'
import Doc from '../types/Doc'
import Query, { getIdsName } from '../types/Query'
import QueryExtra from '../types/QueryExtra'
import Local from '../types/Local'
import Value from '../types/Value'
import { batching } from '../subscribe'
import { subDoc, subLocal, subValue, subQuery } from '../subscriptionTypeFns'
import $root from '@react-sharedb/model'

export function useModel (...args) {
  return useMemo(() => $root.scope(...args), [...args])
}

const HOOKS_COLLECTION = '$hooks'
const $hooks = $root.scope(HOOKS_COLLECTION)

export const useDoc = generateUseItemOfType(subDoc)
export const useQuery = generateUseItemOfType(subQuery)
export const useLocal = generateUseItemOfType(subLocal)
export const useValue = generateUseItemOfType(subValue)

function generateUseItemOfType (typeFn) {
  let isQuery = typeFn === subQuery
  let isSync = typeFn === subLocal || typeFn === subValue
  let useDymamic = isSync ? useSync : useAsync
  return (...args) => {
    let hookId = useMemo(() => $root.id(), [])
    let hashedArgs = useMemo(() => JSON.stringify(args), args)

    const initsCountRef = useRef(0)
    const cancelInitRef = useRef()
    const destructorsRef = useRef([])

    useUnmount(() => {
      if (cancelInitRef.current) cancelInitRef.current.value = true
      destructorsRef.current.forEach(destroy => destroy())
      destructorsRef.current.length = 0
      $hooks.destroy(hookId)
    })

    const params = useMemo(() => typeFn(...args), [hashedArgs])

    const initItem = useCallback(params => {
      // Cancel previous initialization if it is active
      if (cancelInitRef.current) cancelInitRef.current.value = true

      let item = getItemFromParams(params, hookId)
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

          // Mark that initialization completed
          initsCountRef.current++

          // Reference the new item data
          item.refModel()
        })
      }

      if (isSync) {
        finishInit()
      } else {
        item.init().then(finishInit)
      }
    }, [])

    useDymamic(() => initItem(params), [hashedArgs])

    // ----- model -----

    // For Query and QueryExtra return the scoped model targeting the actual collection path.
    // This is much more useful since you can use that use this returned model
    // to update items with: $queryCollection.at(itemId).set('title', 'FooBar')
    const collectionName = useMemo(
      () => (isQuery ? getCollectionName(params) : undefined),
      [hashedArgs]
    )
    const $queryCollection = useMemo(
      () => (isQuery ? $root.scope(collectionName) : undefined),
      [collectionName]
    )

    // For Doc, Local, Value return the model scoped to the hook path
    // But only after the initialization actually finished, otherwise
    // the ORM won't be able to properly resolve the path which was not referenced yet
    const $model = useMemo(
      () => (!isQuery && initsCountRef.current ? $hooks.at(hookId) : undefined),
      [initsCountRef.current]
    )

    // ----- data -----

    // In any situation force access data through the object key to let observer know that the data was accessed
    let data = $hooks.get()[hookId]

    // ----- return -----

    return [
      // Initialize async item as `null`
      // This way the strict `value === null` check can be used to determine
      // precisely whether the subscribe has finished executing
      initsCountRef.current ? data : null,

      // Query, QueryExtra: return scoped model to collection path.
      // Everything else: return the 'hooks.<randomHookId>' scoped model.
      $queryCollection || $model

      // TODO: Maybe enable returning array of ids for Query in future.
      //       The potential drawback is that the rendering might fire twice
      //       when the subscribed data changes (items added or removed from query).
      //       This needs to be tested before enabling.
      // Return ids array as the third parameter for useQuery
      // idsName ? res.push($hooks.get()[idsName]) : undefined
    ]

    // TODO: Maybe enable returning array of ids for Query in future.
    //       See below for more info.
    // ----- ids -----
    // const idsName = useMemo(() => (
    //   hasIds(params) ? getIdsName(hookId) : undefined
    // ), [])
  }
}

function getCollectionName (params) {
  return params && params.params && params.params[0]
}

// TODO: Maybe enable returning array of ids for Query in future.
function hasIds (params) {
  let explicitType = params && params.__subscriptionType
  return explicitType === 'Query'
}

function getItemFromParams (params, key) {
  let explicitType = params && params.__subscriptionType
  let subscriptionParams = params.params
  let constructor = getItemConstructor(explicitType)
  return new constructor($hooks, key, subscriptionParams)
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

function useSync (fn, inputs) {
  useMemo(() => {
    fn()
  }, inputs)
}

function useAsync (fn, inputs) {
  useLayoutEffect(() => {
    fn()
  }, inputs)
}

// TODO: Might be useful in future as a sync alternative to useEffect
function useSyncEffect (fn, inputs) {
  let prevCleanup = useRef()
  useMemo(() => {
    batching.batch(() => {
      prevCleanup.current && prevCleanup.current()
      prevCleanup.current = fn()
    })
  }, inputs)
  useUnmount(() => {
    batching.batch(() => {
      prevCleanup.current && prevCleanup.current()
    })
  })
}
