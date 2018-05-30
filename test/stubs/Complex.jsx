import React from 'react'
import _ from 'lodash'

const ITEMS_AMOUNT = 4

export default () =>
  class Complex extends React.Component {
    constructor (props) {
      super(props)
      this.renderCount = 0
    }

    render () {
      this.renderCount++
      let { get, at, atMap } = this.model
      if (typeof DEBUG !== 'undefined') {
        console.log(`RENDER ${this.renderCount}:`)
      }
      let itemEls = []
      for (let i = 0; i < ITEMS_AMOUNT; i++) {
        let $items = at(`items${i}`)
        let names
        // Handle situation when subscribing to one doc instead of query
        if (_.isArray($items.get())) {
          names = $items.atMap($i => $i.get('name')).join(',')
        } else {
          names = $items.get('name')
        }
        if (typeof DEBUG !== 'undefined') console.log(`  ${i}: ${names}`)
        itemEls.push(
          <div className={`items${i}`} key={i}>
            {names}
          </div>
        )
      }
      return (
        <div className={`Complex RENDER-${this.renderCount}`}>{itemEls}</div>
      )
    }
  }
