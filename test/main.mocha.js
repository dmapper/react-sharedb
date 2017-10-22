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
  w.getItems = function () { return getSimpleItems(this) }
  Object.defineProperty(w, 'items', {
    get: function () { return this.getItems() }
  })
  w.nextRender = function () { return nextRender(this) }
  return w
}

function getSimpleItems (w) {
  return w.find('.Simple').text().split(',')
}

function alias (number) {
  const name = n => `test${n}_`
  if (_.isArray(number)) {
    return number.map(n => name(n))
  } else {
    return name(number)
  }
}

async function nextRender (w) {
  let currentRender = w.html().match(/data-render-count="(\d+)"/)[1]
  if (!currentRender) throw new Error('Component didn\'t render')
  // console.log('>> current', currentRender)
  // return new Promise(resolve => {
  //   setTimeout(() => {
  //     console.log('>>>>>', w.html())
  //     resolve()
  //   }, 1500)
  // })
  await w.waitFor(`.Simple[data-render-count="${currentRender + 1}"]`)
}

// Workaround to init rpc and subscribe only after the server started (which is a global before)
before(() => {
  serverModel = require('./_client/initRpc')
  subscribe = require('../src').subscribe
})

describe('Helpers', () => {

  it('test RPC', async () => {
    let w

    await serverModel.setAsync(`users.${alias(1)}.name`, alias(1))
    w = await initSimple(() => ({items: ['users', alias(1)]}))
    expect(w.items).to.include(alias(1))

    await serverModel.setAsync(`users.${alias(1)}.name`, 'Abrakadabra')
    w = await initSimple(() => ({items: ['users', alias(1)]}))
    expect(w.items).to.include('Abrakadabra')

    await serverModel.setAsync(`users.${alias(1)}.name`, alias(1))
    w = await initSimple(() => ({items: ['users', alias(1)]}))
    expect(w.items).to.include(alias(1))
  })

})

describe('Docs', () => {

  it('doc by id', async () => {
    let w

    w = await initSimple(() => ({items: ['users', alias(1)]}))
    expect(w.items.length).to.eql(1)
    expect(w.items).to.include(alias(1))

    w = await initSimple(() => ({items: ['users', alias(4)]}))
    expect(w.items.length).to.eql(1)
    expect(w.items).to.include(alias(4))
  })

})

describe('Queries', () => {

  it('all collection', async () => {
    let w = await initSimple(() => ({items: ['users', {}]}))
    expect(w.items.length).to.eql(5)
    expect(w.items).to.include.members(alias([1, 2, 3, 4, 5]))
  })

  it('parametrized 1', async () => {
    let w = await initSimple(() => ({items: ['users', {color: 'blue'}]}))
    expect(w.items.length).to.eql(2)
    expect(w.items).to.include.members(alias([1, 2]))
  })

  it('parametrized 2', async () => {
    let w = await initSimple(() => ({items: ['users', {color: 'red'}]}))
    expect(w.items.length).to.eql(3)
    expect(w.items).to.include.members(alias([3, 4, 5]))
  })

  it.skip('dynamic update of query param', async () => {
    let w = await initSimple({color: 'red'}, 'color', (props) => ({
      items: ['users', {color: props.color}]
    }))
    expect(w.items.length).to.eql(3)
    expect(w.items).to.include.members(alias([3, 4, 5]))
    w.setProps({color: 'blue'})
    await w.nextRender()
    expect(w.items.length).to.eql(2)
    expect(w.items).to.include.members(alias([1, 2]))
  })
})
