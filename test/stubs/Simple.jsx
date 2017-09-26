import React from 'react'
import {subscribe} from '../../src'

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
    let {renderCount} = this.state
    if (typeof DEBUG !== 'undefined') console.log(`RENDER ${renderCount}:`, items.map(i => i.name).join(','))
    return (
      <div
        className='Simple'
        data-render-count={renderCount}
      >
        { items.map(i => i.name).join(',') }
      </div>
    )
  }

}