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
      let { items = [] } = this.data
      // Handle situation when subscribing to one doc instead of query
      console.log('> before', this.data)
      if (!_.isArray(items)) items = [items]
      console.log('> after', this.data)
      let names = items.map(i => i.name).join(',')
      if (typeof DEBUG !== 'undefined') {
        console.log(`RENDER ${this.renderCount}:`, names)
      }
      return <div className={`Simple RENDER-${this.renderCount}`}>{names}</div>
    }
  }
