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

export function useModel (path) {
  return useMemo(() => $root.scope(path), [path])
}

const DEFAULT_COLLECTION = '$hooks'
const $collection = $root.scope(DEFAULT_COLLECTION)

export const useDoc = generateUseItemOfType(subDoc)
export const useQuery = generateUseItemOfType(subQuery)
export const useLocal = generateUseItemOfType(subLocal)
export const useValue = generateUseItemOfType(subValue)

function generateUseItemOfType (typeFn) {
  let isSync = typeFn === subLocal || typeFn === subValue
  return (...args) => {
    let $model = useMemo(() => generateScopedModel(), [])

    let hashedArgs = useMemo(() => JSON.stringify(args), args)

    const cancelInitRef = useRef()
    const destructorsRef = useRef([])
    const didMountRef = useRef(false)
    const didInitRef = useRef(false)

    useUnmount(() => {
      if (cancelInitRef.current) cancelInitRef.current.value = true
      destructorsRef.current.forEach(destroy => destroy())
      destructorsRef.current.length = 0
      $model.destroy()
    })

    const params = useMemo(() => typeFn(...args), [hashedArgs])
    const collectionName = useMemo(
      () => (isQuery(params) ? getCollectionName(params) : undefined),
      [hashedArgs]
    )

    // For Query and QueryExtra return the scoped model targeting the actual collection path.
    // This is much more useful since you can use that use this returned model
    // to update items with: $queryCollection.at(itemId).set('title', 'FooBar')
    const $queryCollection = useMemo(
      () => (collectionName ? $root.scope(collectionName) : undefined),
      [collectionName]
    )

    // TODO: Maybe enable returning array of ids for Query in future.
    //       See below for more info.
    // const idsName = useMemo(() => (
    //   hasIds(params) ? getIdsName($model.leaf()) : undefined
    // ), [])

    const initItem = useCallback(params => {
      // Cancel previous initialization if it is active
      if (cancelInitRef.current) cancelInitRef.current.value = true

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
          didInitRef.current = true
          item.refModel()
        })
      }

      if (isSync) {
        finishInit()
      } else {
        item.init().then(finishInit)
      }
    }, [])

    // In case the data can be retrieved synchronously, get it right away
    if (isSync && !didInitRef.current) initItem(params)

    useLayoutEffect(
      () => {
        // In case the result was retrieved synchronously, don't init again
        if (isSync && !didMountRef.current) {
          didMountRef.current = true
          return
        }
        initItem(params)
      },
      [hashedArgs]
    )

    // In any situation force access data through the object key to let observer know that the data was accessed
    let data = $collection.get()[$model.leaf()]

    return [
      // Initialize async item as `null`
      // This way the strict `value === null` check can be used to determine
      // precisely whether the subscribe has finished executing
      isSync || didInitRef.current ? data : null,

      // Query, QueryExtra: return scoped model to collection path.
      // Everything else: return the 'hooks.<randomHookId>' scoped model.
      $queryCollection || $model

      // TODO: Maybe enable returning array of ids for Query in future.
      //       The potential drawback is that the rendering might fire twice
      //       when the subscribed data changes (items added or removed from query).
      //       This needs to be tested before enabling.
      // Return ids array as the third parameter for useQuery
      // idsName ? res.push($collection.get()[idsName]) : undefined
    ]
  }
}

function getCollectionName (params) {
  return params && params.params && params.params[0]
}

function isQuery (params) {
  let explicitType = params && params.__subscriptionType
  return explicitType === 'Query' || explicitType === 'QueryExtra'
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
