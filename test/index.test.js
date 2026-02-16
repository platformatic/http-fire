'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

describe('public API', () => {
  it('should export TrafficGenerator, TrafficRunner and RequestError', () => {
    const { TrafficGenerator, TrafficRunner, RequestError } = require('../index')
    assert.equal(typeof TrafficGenerator, 'function')
    assert.equal(typeof TrafficRunner, 'function')
    assert.equal(typeof RequestError, 'function')
  })

  it('should create a TrafficGenerator instance', () => {
    const { TrafficGenerator } = require('../index')
    const gen = new TrafficGenerator({ min: 10, max: 100, noise: 0, steady: 55, spike: 60 })
    assert.equal(typeof gen.next, 'function')
  })

  it('should create a TrafficRunner instance', () => {
    const { TrafficRunner } = require('../index')
    const runner = new TrafficRunner('http://127.0.0.1:1', () => {})
    assert.equal(typeof runner.setRate, 'function')
    assert.equal(typeof runner.stop, 'function')
    assert.equal(runner.currentRate, 0)
    runner.stop()
  })
})
