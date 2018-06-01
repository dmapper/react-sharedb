import React from 'react'
import _ from 'lodash'
import { isObservable } from '@nx-js/observer-util'

export default () =>
  class Simple extends React.Component {
    constructor (props) {
      super(props)
      this.renderCount = 0
    }

    render () {
      this.renderCount++
      let { items = [] } = this.scope
      // Handle situation when subscribing to one doc instead of query
      if (!_.isArray(items)) items = [items]
      let names = items
        .map(i => {
          return i.name
        })
        .join(',')
      if (typeof DEBUG !== 'undefined') {
        console.log(`RENDER ${this.renderCount}:`, names)
      }
      return <div className={`Simple RENDER-${this.renderCount}`}>{names}</div>
    }
  }
