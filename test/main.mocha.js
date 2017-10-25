global.DEBUG = true
import React from 'react'
import { expect } from 'chai'
import { mount } from 'enzyme'
import { createWaitForElement } from 'enzyme-wait'
import _ from 'lodash'
import './_server'

// import Simple from './stubs/Simple'

import ReactWrapper from 'enzyme/build/ReactWrapper'
ReactWrapper.prototype.waitFor = function (selector) {
  return createWaitForElement(selector)(this)
}

let subscribe
let serverModel
let w

async function initSimple (...args) {
  let Simple = require('./stubs/Simple')
  let initialProps = {}
  if (_.isPlainObject(args[0])) {
    initialProps = args[0]
    args = args.slice(1)
  }
  Simple = subscribe(...args)(Simple)
  let w = mount(<Simple {...initialProps} />)
  await w.waitFor('.Simple')
  w.getItems = function () {
    return getSimpleItems(this)
  }
  Object.defineProperty(w, 'items', {
    get: function () {
      return this.getItems()
    }
  })
  w.nextRender = function (count = 1) {
    return nextRender(this, count)
  }
  return w
}

function getSimpleItems (w) {
  let text = w.find('.Simple').text()
  if (!text) return []
  return text.split(',')
}

function alias (number) {
  const name = n => `test${n}_`
  if (_.isArray(number)) {
    return number.map(n => name(n))
  } else {
    return name(number)
  }
}

async function nextRender (w, count = 1) {
  let currentRender = w.html().match(/RENDER-(\d+)/)[1]
  if (!currentRender) throw new Error("Component didn't render")
  currentRender = ~~currentRender
  // console.log('>> current', currentRender)
  let selector = `.RENDER-${currentRender + count}`
  console.log('wait for:', selector)
  await w.waitFor(selector)
}

// Workaround to init rpc and subscribe only after the server started (which is a global before)
before(() => {
  serverModel = require('./_client/initRpc')
  subscribe = require('../src').subscribe
})

// Unmount component after each test
afterEach(() => {
  if (!w) return
  w.unmount()
})

describe('Helpers', () => {
  it('test RPC', async () => {
    await serverModel.setAsync(`users.${alias(1)}.name`, alias(1))
    w = await initSimple(() => ({ items: ['users', alias(1)] }))
    expect(w.items).to.include(alias(1))
    w.unmount()

    await serverModel.setAsync(`users.${alias(1)}.name`, 'Abrakadabra')
    w = await initSimple(() => ({ items: ['users', alias(1)] }))
    expect(w.items).to.include('Abrakadabra')
    w.unmount()

    await serverModel.setAsync(`users.${alias(1)}.name`, alias(1))
    w = await initSimple(() => ({ items: ['users', alias(1)] }))
    expect(w.items).to.include(alias(1))
  })
})

describe('Docs', () => {
  it('doc by id', async () => {
    w = await initSimple(() => ({ items: ['users', alias(3)] }))
    expect(w.items)
      .to.have.lengthOf(1)
      .and.include(alias(3))
  })

  it('dynamic data update', async () => {
    w = await initSimple(() => ({ items: ['users', alias(1)] }))
    expect(w.items)
      .to.have.lengthOf(1)
      .and.include(alias(1))
    let updateAndCheckName = async newName => {
      serverModel.set(`users.${alias(1)}.name`, newName)
      await w.nextRender()
      expect(w.items)
        .to.have.lengthOf(1)
        .and.include(newName)
    }
    for (let i in _.range(50)) {
      await updateAndCheckName(`TestUpdate${i}_`)
    }
    await updateAndCheckName(alias(1))
  })
})

describe('Queries', () => {
  it('all collection', async () => {
    w = await initSimple(() => ({ items: ['users', {}] }))
    expect(w.items)
      .to.have.lengthOf(5)
      .and.include.members(alias([1, 2, 3, 4, 5]))
  })

  it('parametrized 1', async () => {
    w = await initSimple(() => ({ items: ['users', { color: 'blue' }] }))
    expect(w.items)
      .to.have.lengthOf(2)
      .and.include.members(alias([1, 2]))
  })

  it('parametrized 2', async () => {
    w = await initSimple(() => ({ items: ['users', { color: 'red' }] }))
    expect(w.items)
      .to.have.lengthOf(3)
      .and.include.members(alias([3, 4, 5]))
  })

  it('dynamic data update', async () => {
    w = await initSimple(() => ({ items: ['users', { color: 'red' }] }))
    expect(w.items)
      .to.have.lengthOf(3)
      .and.include.members(alias([3, 4, 5]))
    let updateAndCheckItems = async (index, color, indexes, decrease) => {
      serverModel.set(`users.${alias(index)}.color`, color)
      // Wait for 2 renders when the item is going to disappear from
      // the query results.
      // NOTE: 2 renderings are happening because when
      // the data is changed in the item which is already loaded to
      // the client-side model, it is not getting removed from
      // the query result immediately since the doc ids are updated
      // by query only from the server-side.
      // So for some time the document which doesn't match the query
      // anymore, will still be present in the array.
      let renders = decrease ? 2 : 1
      await w.nextRender(renders)
      expect(w.items)
        .to.have.lengthOf(indexes.length)
        .and.include.members(alias(indexes))
    }
    await updateAndCheckItems(3, 'blue', [4, 5], true)
    await updateAndCheckItems(4, 'blue', [5], true)
    await updateAndCheckItems(1, 'red', [1, 5])
    await updateAndCheckItems(3, 'red', [1, 3, 5])
    await updateAndCheckItems(5, 'blue', [1, 3], true)
    await updateAndCheckItems(1, 'blue', [3], true)
    await updateAndCheckItems(3, 'blue', [], true)
    await updateAndCheckItems(5, 'red', [5])
    await updateAndCheckItems(3, 'red', [3, 5])
    await updateAndCheckItems(4, 'red', [3, 4, 5])
  })

  it('dynamic update of query param', async () => {
    w = await initSimple({ color: 'red' }, 'color', props => ({
      items: ['users', { color: props.color }]
    }))
    expect(w.items)
      .to.have.lengthOf(3)
      .and.include.members(alias([3, 4, 5]))
    for (let i = 0; i < 20; i++) {
      w.setProps({ color: 'blue' })
      await w.nextRender()
      expect(w.items)
        .to.have.lengthOf(2)
        .and.include.members(alias([1, 2]))
      w.setProps({ color: 'red' })
      await w.nextRender()
      expect(w.items)
        .to.have.lengthOf(3)
        .and.include.members(alias([3, 4, 5]))
    }
  })
})
