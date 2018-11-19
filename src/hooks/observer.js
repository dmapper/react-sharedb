// ref: https://github.com/mobxjs/mobx-react-lite/blob/master/src/observer.ts
import { memo, useEffect, useMemo, useState } from 'react'
import { observe, unobserve } from '@nx-js/observer-util'
import { batching } from '../subscribe'

export function observer (baseComponent) {
  const baseComponentName = baseComponent.displayName || baseComponent.name
  // memo; we are not intested in deep updates
  // in props; we assume that if deep objects are changed,
  // this is in observables, which would have been tracked anyway

  const memoComponent = memo(props => {
    // forceUpdate 2.0
    const forceUpdate = useForceUpdate()

    // wrap the baseComponent into an observe decorator once.
    // This way it will track any observable changes and will trigger rerender
    const observedComponent = useMemo(() => {
      let update = () => {
        // TODO: Decide whether the check for unmount is needed here
        forceUpdate()
      }
      let batchedUpdate = () => batching.add(update)
      return observe(baseComponent, {
        scheduler: batchedUpdate,
        lazy: true
      })
    }, [])

    // clean up observer on unmount
    useUnmount(() => unobserve(observedComponent))

    return observedComponent(props)
  })
  memoComponent.displayName = baseComponentName
  return memoComponent
}

function useForceUpdate () {
  const [tick, setTick] = useState(1)
  return () => {
    setTick(tick + 1)
  }
}

function useUnmount (fn) {
  useEffect(() => fn, [])
}
