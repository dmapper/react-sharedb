# react-sharedb

> Run `ShareDB` in `React`

# What it does

1. Brings real-time collaboration to React using ShareDB;
2. Uses [Racer](https://derbyjs.com/docs/derby-0.10/models) to add a `model`
   to your app to do any data manipulations;
3. The `model` acts as a global singleton state, so you can use it as a
   replacement for other state-management systems like `Redux` or `MobX`;
4. Makes the `render` reactive similar to how it's done in `MobX` --
   rerendering happens whenever any `model` data you used in `render`
   changes.   

# Usage

Below is an example of a simple app with 2 components:
1. `Home` -- sets up my userId and renders `Room`
2. `Room` -- shows my user name ands lets user update it,
   shows all users which are currently in the room.

```js
// Home.jsx
import React from 'react'
import Room from './Room.jsx'
import {model, subscribe} from 'react-sharedb'

// `subscribe` means that the data is reactive and gets dynamically updated
// whenever the data in MongoDB or in private collections gets updated.

@subscribe(props => ({
  // Subscribe to the path in a private collection `_session`.
  //
  // `private` collection means that the data does NOT get synced with MongoDB.
  // Data in these collections live only on the client-side.
  //  
  // Collection is considered `private` when its name starts from `_` or `$`.
  //
  // Private collections like `_session` are used as a singleton client-only storage,
  // an alternative to `Redux` or `MobX`.
  // 
  // You can have as many private collections as you like, but the common
  // guideline is to use just one collection to store all private data -- `_session`
  userId: '_session.userId'
}))

export default class Home extends React.Component {
  constructor (...props) {
    super(...props)
    
    // For each thing you subscribe to, you receive a scoped `model`
    // with the same name prefixed with `$` in `props`. Use it
    // to update the data with the `model` operations available in Racer:
    // https://derbyjs.com/docs/derby-0.10/models     
    let {$userId} = this.props

    // Update the private path `_session.userId` with the new value
    //
    // We'll use this `_session.userId` in all other children
    // components to easily get the userId without doing the potentially
    // heavy/long process of fetching the userId over and over again.
    $userId.set(this.getUserId())    
  }  

  // Get my userId somehow (for example from the server-side response).
  // For simplicity, we'll just generate a random guid in this example
  // by creating an empty user document each time, so whenever 
  // you open a new page, you'll be a new user.        
  getUserId = () => model.add('users', {})

  render = () => <Room roomId={'myCoolRoom1'} />
}
```

```js
// Room.jsx
import React from 'react'
import {model, subscribe} from 'react-sharedb'

@subscribe(props => ({

  // Subscribe to the same private path again to get the userId, which
  // we did manually setup in the parent `<Home>` component.
  // The pattern of subscribing and updating data in a private path
  // can be used to expose some data from one component to another.   
  userId: '_session.userId',
  
  // Subscribe to the particular document from a public collection `rooms` by id.
  // `public` means that it DOES sync with MongoDB.
  // `public` collection names start with a regular letter a-z.
  // You can also use ClassCase for collection names (A-Z), but it is
  // NOT recommended unless you have such guidelines in your project.  
  room: ['rooms', props.roomId]
  
}))

// All things you subscribe to end up in `props.scope` under the same name.
// We can do a second subscribe using the data we received in the first one.

@subscribe(props => ({

  // Subscribe to the particular document from a public collection by id
  // which we got from the previous subscription
  myUser: ['users', props.scope.userId],
  
  // Subscribe to a query to get docs from a public `users` collection
  // using the array of userIds from `room` received in the previous subscription 
  users: ['users', {_id: {
    $in: props.scope.room && props.scope.room.userIds || []
  }}]
    
}))

// Additionally, whenever you subscribe to the MongoDB query, you also
// receive the `Ids` in scope.
// For example, subscribing to the `users` collection above populated
// `props.scope.users` (array of documents) AND
// `props.scope.userIds` (array of ids) - auto singular name with the `Ids` suffix
 
export default class Room extends React.Component {
  constructor (...props) {
    super(...props)    
    let {$room, roomId} = this.props
    let {userId, room, room: {userIds = []}} = this.props.scope
    
    // Create an empty room if it wasn't created yet
    if (!room) model.add('rooms', {id: roomId, title: `Room #${roomId}`})
    
    // Add user to the room unless he's already there
    if (!userIds.includes(userId)) $room.push('userIds', userId)
  }
    
  changeName = (event) => {
    let {$myUser} = this.props
    $myUser.setEach({name: event.target.value})
  }
  
  render () {
    let { myUser, room, users, userId } = this.props.scope
    return (
      <main>
        <h1>{room.title}</h1>
        <section>
          My User Name:
          <input type='text' value={myUser.name} onChange={this.changeName} />
        </section>
        <h3>Users in the room:</h3>
        {
          users
          .filter(({id}) => id !== userId) // exclude my user
          .map(user =>
            <section key={user.id}>
              {user.name || `User ${user.id}`}
            </section>
          )
        }
      </main>
    )
  }
}
```

# Licence

MIT

(c) Decision Mapper - http://decisionmapper.com
