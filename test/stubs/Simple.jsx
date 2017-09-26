import React from 'react'
import {subscribe} from '../../src'

export default class Simple extends React.Component {

  constructor (props) {
    super(props)
    this.state = {}
  }

  render () {
    let {items} = this.props
    return <div className='Simple'>{ items.map(i => i.name).join(',') }</div>
  }

}