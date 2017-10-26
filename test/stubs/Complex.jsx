import React from 'react'
import _ from 'lodash'

const ITEMS_AMOUNT = 4

export default class Complex extends React.Component {
  constructor (props) {
    super(props)
    this.state = {
      renderCount: 1
    }
  }

  componentWillReceiveProps () {
    this.setState({ renderCount: this.state.renderCount + 1 })
  }

  render () {
    let { renderCount } = this.state
    if (typeof DEBUG !== 'undefined') console.log(`RENDER ${renderCount}:`)
    let itemEls = []
    for (let i = 0; i < ITEMS_AMOUNT; i++) {
      let items = this.props[`items${i}`]
      // Handle situation when subscribed to non exist doc
      if (!items) items = []
      // Handle situation when subscribing to one doc instead of query
      if (!_.isArray(items)) items = [items]
      if (typeof DEBUG !== 'undefined') {
        console.log('  ' + i + ': ' + items.map(i => i.name).join(','))
      }
      itemEls.push(
        <div className={`items${i}`} key={i}>
          {items.map(i => i.name).join(',')}
        </div>
      )
    }
    return <div className={`Complex RENDER-${renderCount}`}>{itemEls}</div>
  }
}
