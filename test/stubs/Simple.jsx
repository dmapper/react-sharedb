import React from 'react'
import _ from 'lodash'

export default class Simple extends React.Component {

  constructor (props) {
    super(props)
    this.state = {
      renderCount: 1
    }
  }

  componentWillReceiveProps () {
    this.setState({renderCount: this.state.renderCount + 1})
  }

  render () {
    let {items} = this.props
    // Handle situation when subscribed to non exist doc
    if (!items) items = []
    // Handle situation when subscribing to one doc instead of query
    if (!_.isArray(items)) items = [items]
    let {renderCount} = this.state
    if (typeof DEBUG !== 'undefined') console.log(`RENDER ${renderCount}:`, items.map(i => i.name).join(','))
    return (
      <div
        className={`Simple RENDER-${renderCount}`}
      >
        { items.map(i => i.name).join(',') }
      </div>
    )
  }

}