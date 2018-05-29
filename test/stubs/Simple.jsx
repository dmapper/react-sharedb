import React from 'react'
import _ from 'lodash'

export default () =>
  class Simple extends React.Component {
    constructor (props) {
      super(props)
      this.renderCount = 0
    }

    render () {
      this.renderCount++
      let { get, at, atMap } = this.model
      let items = get('items')
      let names
      // Handle situation when subscribing to one doc instead of query
      if (_.isArray(items)) {
        names = atMap('items', $i => $i.get('name')).join(',')
      } else {
        names = get('items.name')
      }
      if (typeof DEBUG !== 'undefined') {
        console.log(`RENDER ${this.renderCount}:`, names)
      }
      return <div className={`Simple RENDER-${this.renderCount}`}>{names}</div>
    }
  }
