> **!!! IMPORTANT !!! This package is moved to a new repo. This repo is now DEPRECATED.**
> 
> **For the latest documentation and usage examples, refer to StartupJS framework and the `@startupjs/react-sharedb` package there:**
>
> - [StartupJS](https://github.com/startupjs/startupjs)
> - [Up to date React-ShareDB](https://github.com/startupjs/startupjs/tree/master/packages/react-sharedb)

> Below is the OLD documentation of the deprecated standalone `react-sharedb` package:

# react-sharedb

> Run `ShareDB` in `React`

## What it does

1. Brings real-time collaboration to React using [ShareDB](https://github.com/share/sharedb);
2. Uses [Racer](https://derbyjs.com/docs/derby-0.10/models) to add a `model`
   to your app to do any data manipulations;
3. The `model` acts as a global singleton state, so you can use it as a
   replacement for other state-management systems like `Redux` or `MobX`;
4. Makes the `render` reactive similar to how it's done in `MobX` --
   rerendering happens whenever any `model` data you used in `render`
   changes.   

## *\[Hooks\]* `use*()`

### `observer(FunctionalComponent)` HOF

Higher Order Function which makes your functional component rendering reactive.
**You have to** wrap your functional components in it to be able to use `react-sharedb` hooks.

```js
import {observer, useDoc} from 'react-sharedb'
export default observer(function User ({userId}) {
  let [user, $user] = useDoc('users', userId)  
  if (!user) return null // <Loading />
  return (
    <input value={user.name} onChange={e => $user.set('name', e.target.value)} />
  )
})
```

### `useDoc(collection, docId)`

Refer to the documentation of [`subDoc()`](#subDoc) below

### `useLocalDoc(collection, docId)`

A convenience method to get the document you are already subscribed to
using the same API as `useDoc()`

```js
let [game, $game] = useLocalDoc('games', gameId)
// It's the same as doing:
let [game, $game] = useLocal('games.' + gameId)
```

### `useQuery(collection, query)`

Refer to the documentation of [`subQuery()`](#subQuery) below

### `useQueryIds(collection, ids, options)`

Subscribe to documents in collection by their ids

`collection` \[String\] -- collection name. Required
`ids` \[Array\] -- array of strings which should be document ids.
`options` \[Object\] -- 
    ```js
    { 
      reverse: false // reverse the order of resulting array
    }
    ```

Example:

```js
observer(function Players ({ gameId }) {
  let [game] = useDoc('games', gameId)
  if (!game) return null // <Loading />
  let [players, $players] = useQueryIds('players', game.playerIds)
  if (!players) return null // <Loading />

  return (
    <div>{players.map(i => i.name).join(' ,')}</div>
  )
})
```

### `useQueryDoc(collection, query)`

Subscribe to a document using a query. It's the same as `useDoc()`, but
with `query` parameter instead of the particular `docId`.
`$limit: 1` and `$sort: { createdAt: -1 }` are added to the query automatically (if they don't already exist). 

`collection` \[String\] -- collection name. Required
`query` \[Object\] -- query object, same as in `useQuery()`.

Example:

```js
observer(function NewPlayer ({ gameId }) {
  // { $sort: { createdAt: -1 }, $limit: 1 }   
  // is added automatically to the query, so the newest player will be returned.
  // It's also reactive, so whenever a new player joins, you'll receive the new data and model.
  let [newPlayer, $newPlayer] = useQueryDoc('players', { gameId })
  if (!newPlayer) return null // <Loading />

  return (
    <div>New player joined: {newPlayer.name}</div>
  )
})
```

### `useLocal(path)`

Refer to the documentation of [`subLocal()`](#subLocal) below

### `useSession(path)`

A convenience method to access the `_session` local collection.

```js
let [userId, $userId] = useSession('userId')
// It's the same as doing:
let [userId, $userId] = useLocal('_session.userId')
``` 

### `usePage(path)`

A convenience method to access the `_page` local collection.

```js
let [game, $game] = usePage('game')
// It's the same as doing:
let [game, $game] = useLocal('_page.game')
``` 

### `useValue(value)`

Refer to the documentation of [`subValue()`](#subValue) below

### `useModel(path)`

Return a model scoped to `path` (memoized by the `path` argument).
If `path` is not provided, returns the model scoped to the root path.

```js
import React from 'react'
import {render} from 'react-dom'
import {observer, useModel, useLocal} from 'react-sharedb'

const Main = observer(() => {
  return (
    <div style={{display: 'flex'}}>
      <Content />
      <Sidebar />
    </div>
  )
})

const Content = observer(() => {
  let $showSidebar = useModel('_page.Sidebar.show')

  // sidebar will be opened without triggering rerendering of the <Content /> component (this component)
  return (
    <div>
      <p>I am Content</p>
      <button onClick={() => $showSidebar.setDiff(true)}>Open Sidebar</button>
    </div>
  )
})

const Sidebar = observer(() => {
  let [show, $show] = useLocal('_page.Sidebar.show')
  if (!show) return null
  return (
    <div>
      <p>I am Sidebar</p>
      <button onClick={() => $show.del()}>Close</button>
    </div>
  )
})

render(<Main />, document.body.appendChild(document.createElement('div')))
```

### *\[Hooks\]* Example

```js
import React from 'react'
import {observer, useDoc, useQuery, useLocal, useValue} from 'react-sharedb'

export default observer(function Game ({gameId}) {
  let [secret, $secret] = useValue('Game Secret Password')
  let [userId, $userId] = useLocal('_session.userId')
  let [user, $user] = useDoc('users', userId)
  let [game, $game] = useDoc('games', gameId)
  if (!(game && user)) return null // <Loading />
  
  let [players, $players] = useQuery('players', {_id: {$in: game.playerIds}})
  if (!players) return null // <Loading />
  
  let [users, $users] = useQuery('users', {_id: {$in: players.map(i => i.userId)}})
  if (!users) return null // <Loading />
  
  function updateSecret (event) {
    $secret.set(event.target.value)
  }
  
  function updateName (event) {
    $user.set('name', event.target.value)
  }
  
  return (
    <div>
      <label>
        Secret:
        <input type='text' value={code} onChange={updateSecret} />
      </label>
    
      <label>
        My User Name:
        <input type='text' value={user.name} onChange={updateName} />
      </label>
      
      <h1>Game {game.title}</h1>
      
      <h2>Users in game:</h2>
      <p>{users.map(i => i.name).join(', ')}</p>
    </div>
  )
})
```

### TODO:

1. `useSubscribe(fns)`
2. `<Suspense />` support

## *\[Classes\]* HOC `@subscribe(cb)`

`@subscribe` decorator is used to specify what you want to subscribe to.

`@subscribe` gives react component a personal local scope model, located at path `$components.<random_id>`.
This model will be automatically cleared when the component is unmounted.

### HOW TO: Subscribe to data and use it in render()

`@subscribe` accepts a single argument -- `cb`, which receives `props` and must return the `subscriptions object`.

Each `key` in the `subscriptions object` will fetch specified data from the MongoDB or a Local path and
will write it into the component's personal scope model under that `key`.

The read-only data of the component's model is available as `this.props.store`.
Use it to render the data you subscribed to, same way you would use `this.state`.

**IMPORTANT** As with `this.state`, the `this.props.store` **SHOULD NOT** be modified directly! Read below to find out how to modify data.

Example:

```js
import React from 'react'
import {subscribe, subLocal, subDoc, subQuery} from 'react-sharedb'

@subscribe(props => ({
  myUserId: subLocal('_session.userId'),
  room: subDoc('rooms', props.roomId)
}))
@subscribe(props => ({
  myUser: subDoc('users', props.store.userId),
  usersInRoom: subQuery('users', {_id: {
    $in: props.store.room && props.store.room.userIds || []
  }})
}))
export default class Room extends React.Component {
  render () {
    let {room, myUser, usersInRoom} = this.props.store
    return <Fragment>
      <h1>{room.name}</h1>
      <h2>Me: {myUser.name}</h2>
      <p>Other users in the room: {usersInRoom.map(user => user.name)}</p>
    </Fragment>
  } 
}
```

As seen from the example, you can combine multiple `@subscribe` one after another.

### HOW TO: Modify the data you subscribed to

The actual scoped model of the component is available as `this.props.$store`.
Use it to modify the data. For the API to modify stuff refer to the [Racer documentation](https://derbyjs.com/docs/derby-0.10/models)

In addition, all things from `subscriptions object` you subscribed to are
available to you as additional scope models in `this.props` under names `this.props.$KEY`

Example:

```js
import React from 'react'
import {subscribe, subLocal, subDoc, subQuery} from 'react-sharedb'

@subscribe(props => ({
  room: subDoc('rooms', props.roomId)
}))
export default class Room extends React.Component {
  updateName = () => {
    let {$store, $room} = this.props
    $room.set('name', 'New Name')
    // You can also use $store to do the same:
    $store.set('room.name', 'New Name')
  }
  render () {
    let {room} = this.props.store
    return <Fragment>
      <h1>{room.name}</h1>
      <button onClick={this.updateName}>Update Name</button>
    </Fragment>
  } 
}
```

## *\[Classes\]* `sub*()` functions

Use sub*() functions to define a particular subscription.

<a name="subDoc"></a>
### `subDoc(collection, docId)`

Subscribe to a particular document.
You'll receive the document data as `props.store.{key}`

`collection` \[String\] -- collection name. Required
`docId` \[String\] -- document id. Required

Example:

```js
@subscribe(props => ({
  room: subDoc('rooms', props.roomId)
}))
```

<a name="subQuery"></a>
### `subQuery(collection, query)`

Subscribe to the Mongo query.
You'll receive the docuents as an array: `props.store.{key}`
You'll also receive an array of ids of those documents as `props.store.{key}Ids`

`collection` \[String\] -- collection name. Required
`query` \[Object\] -- query (regular, `$count`, `$aggregate` queries are supported). Required

Example:

```js
@subscribe(props => ({
  users: subQuery('users', { roomId: props.roomId, anonymous: false })
}))
```

**IMPORTANT:** The scope model `${key}`, which you receive from subscription, targets
an the array in the local model of the component, NOT the global `collection` path.
So you won't be able to use it to efficiently update document's data. Instead you should manually
create a scope model which targets a particular document, using the id:

```js
let {usersInRoom, $store} = this.props.store
for (let user of usersInRoom) {
  $store.scope(`${collection}.${user.id}`).setEach({
    joinedRoom: true,
    updatedAt: Date.now()
  })
} 
```

<a name="subLocal"></a>
### `subLocal(path)`

Subscribe to the data you already have in your local model by path.
You'll receive the data on that path as `props.store.{key}`

You will usually use it to subscribe to private collections like `_page` or `_session`.
This is very useful when you want to share the state between multiple components.

It's also possible to subscribe to the path from a public collection, for example when you
want to work with some nested value of a particular document you have already subscribed to. 

Example:

```js
const TopBar = subscribe(props => ({
  sidebarOpened: subLocal('_page.Sidebar.opened')
}))({
  $sidebarOpened
}) => 
  <button 
    onClick={() => $sidebarOpened.setDiff(true)}
  >Open Sidebar</button>

const Sidebar = subscribe(props => ({
  sidebarOpened: subLocal('_page.Sidebar.opened')
}))({
  store: {sidebarOpened}
}) => 
  sidebarOpened ? <p>Sidebar</p> : null
```

<a name="subValue"></a>
### `subValue(value)`

A constant value to assign to the local scoped model of the component.

`value` \[String\] -- value to assign (any type)

### *\[Classes\]* Example

Below is an example of a simple app with 2 components:
1. `Home` -- sets up my userId and renders `Room`
2. `Room` -- shows my user name ands lets user update it,
   shows all users which are currently in the room.

```js
// Home.jsx
import React from 'react'
import Room from './Room.jsx'
import {model, subscribe, subLocal, subDoc, subQuery} from 'react-sharedb'

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
  userId: subLocal('_session.userId')
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
import {model, subscribe, subLocal, subDoc, subQuery} from 'react-sharedb'

@subscribe(props => ({

  // Subscribe to the same private path again to get the userId, which
  // we did manually setup in the parent `<Home>` component.
  // The pattern of subscribing and updating data in a private path
  // can be used to expose some data from one component to another.   
  userId: subLocal('_session.userId'),
  
  // Subscribe to the particular document from a public collection `rooms` by id.
  // `public` means that it DOES sync with MongoDB.
  // `public` collection names start with a regular letter a-z.
  // You can also use ClassCase for collection names (A-Z), but it is
  // NOT recommended unless you have such guidelines in your project.  
  room: subDoc('rooms', props.roomId)
  
}))

// All things you subscribe to end up in `props.store` under the same name.
// We can do a second subscribe using the data we received in the first one.

@subscribe(props => ({

  // Subscribe to the particular document from a public collection by id
  // which we got from the previous subscription
  myUser: subDoc('users', props.store.userId),
  
  // Subscribe to a query to get docs from a public `users` collection
  // using the array of userIds from `room` received in the previous subscription 
  users: subQuery('users', {_id: {
    $in: props.store.room && props.store.room.userIds || []
  }})
    
}))

// Additionally, whenever you subscribe to the MongoDB query, you also
// receive the `Ids` in store.
// For example, subscribing to the `users` collection above populated
// `props.store.users` (array of documents) AND
// `props.store.userIds` (array of ids) - auto singular name with the `Ids` suffix
 
export default class Room extends React.Component {
  constructor (...props) {
    super(...props)    
    let {$room, roomId} = this.props
    let {userId, room, room: {userIds = []}} = this.props.store
    
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
    let { myUser, room, users, userId } = this.props.store
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

## Licence

MIT

(c) Decision Mapper - http://decisionmapper.com
