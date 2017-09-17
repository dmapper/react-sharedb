import React from 'react'
import {subscribe} from '../../src'

@subscribe(props => ({
  users: ['users', {}]
}))

export default class Simple extends React.Component {

  constructor (props) {
    super(props)
    this.state = {}
  }

  render () {
    let {users} = this.props
    return <div className='Simple'>{ users.map(i => i.name).join(',') }</div>
  }

}