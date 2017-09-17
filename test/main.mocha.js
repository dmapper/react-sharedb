import React from 'react'
import { expect } from 'chai'
import { mount } from 'enzyme'
import { createWaitForElement } from 'enzyme-wait'
import './_server'

// import Simple from './stubs/Simple'

import ReactWrapper from 'enzyme/build/ReactWrapper'
ReactWrapper.prototype.waitFor = function (selector) {
  return createWaitForElement(selector)(this)
}

describe('main', () => {
  it('should test something', async () => {
    const Simple = require('./stubs/Simple')
    let w = mount(<Simple />)
    await w.waitFor('.Simple')
    expect(w.html()).to.have.string('test1').and.have.string('test2')
  })
})
