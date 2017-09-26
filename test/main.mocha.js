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

async function initSimple (subscribeParamsFn) {
  let Simple = require('./stubs/Simple')
  Simple = subscribe(subscribeParamsFn)(Simple)
  let w = mount(<Simple />)
  await w.waitFor('.Simple')
  w.getItems = function () {
    return getSimpleItems(this)
  }
  Object.defineProperty(w, 'items', {
    get: function () { return this.getItems() }
  })
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

describe('Queries', () => {
  // Workaround to init subscribe only after the server started (which is a global before)
  before(() => {
    subscribe = require('../src').subscribe
  })

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
})
