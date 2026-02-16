'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { TrafficGenerator } = require('../lib/traffic-generator')

const DEFAULT_CONFIG = { min: 50, max: 500, noise: 0.1, steady: 55, spike: 60 }

describe('TrafficGenerator', () => {
  it('should return values within min/max range', () => {
    const generator = new TrafficGenerator(DEFAULT_CONFIG)
    for (let i = 0; i < 500; i++) {
      const value = generator.next()
      assert.ok(value >= 50, `value ${value} is below min 50 at iteration ${i}`)
      assert.ok(value <= 500, `value ${value} is above max 500 at iteration ${i}`)
    }
  })

  it('should return integers', () => {
    const generator = new TrafficGenerator({ min: 10, max: 100, noise: 0.2, steady: 55, spike: 60 })
    for (let i = 0; i < 200; i++) {
      const value = generator.next()
      assert.equal(value, Math.round(value), `value ${value} is not an integer at iteration ${i}`)
    }
  })

  it('should start near minimum value', () => {
    const generator = new TrafficGenerator({ min: 100, max: 1000, noise: 0, steady: 55, spike: 60 })
    const value = generator.next()
    assert.equal(value, 100)
  })

  it('should stay at minimum during initial steady phase with no noise', () => {
    const generator = new TrafficGenerator({ min: 100, max: 1000, noise: 0, steady: 55, spike: 60 })
    // Steady phase lasts exactly 55 iterations
    for (let i = 0; i < 55; i++) {
      const value = generator.next()
      assert.equal(value, 100, `expected 100 at iteration ${i}, got ${value}`)
    }
  })

  it('should eventually produce values above minimum', () => {
    const generator = new TrafficGenerator({ min: 100, max: 1000, noise: 0, steady: 55, spike: 60 })
    let maxSeen = 0
    for (let i = 0; i < 200; i++) {
      const value = generator.next()
      if (value > maxSeen) maxSeen = value
    }
    assert.ok(maxSeen > 100, `expected values above min, max seen was ${maxSeen}`)
  })

  it('should produce varying values over many iterations', () => {
    const generator = new TrafficGenerator({ min: 50, max: 500, noise: 0, steady: 55, spike: 60 })
    const values = new Set()
    for (let i = 0; i < 300; i++) {
      values.add(generator.next())
    }
    assert.ok(values.size > 5, `expected diverse values, only got ${values.size} unique values`)
  })

  it('should respect different min/max ranges', () => {
    const generator = new TrafficGenerator({ min: 1, max: 10, noise: 0, steady: 55, spike: 60 })
    for (let i = 0; i < 300; i++) {
      const value = generator.next()
      assert.ok(value >= 1 && value <= 10, `value ${value} out of range [1, 10]`)
    }
  })

  it('should apply noise when noise factor is set', () => {
    const generator = new TrafficGenerator({ min: 100, max: 1000, noise: 0.5, steady: 55, spike: 60 })
    const values = []
    for (let i = 0; i < 30; i++) {
      values.push(generator.next())
    }
    const unique = new Set(values)
    assert.ok(unique.size > 1, 'expected noise to produce varying values during steady phase')
  })

  it('should produce no variation during steady phase with zero noise', () => {
    const generator = new TrafficGenerator({ min: 200, max: 800, noise: 0, steady: 55, spike: 60 })
    const values = []
    for (let i = 0; i < 55; i++) {
      values.push(generator.next())
    }
    const unique = new Set(values)
    assert.equal(unique.size, 1, 'expected no variation with zero noise in steady phase')
  })

  it('should handle min equal to max', () => {
    const generator = new TrafficGenerator({ min: 500, max: 500, noise: 0, steady: 55, spike: 60 })
    for (let i = 0; i < 100; i++) {
      assert.equal(generator.next(), 500)
    }
  })

  it('should have shorter steady phase with smaller steady value', () => {
    const shortSteady = new TrafficGenerator({ min: 100, max: 1000, noise: 0, steady: 20, spike: 60 })
    // With steady=20, duration is exactly 20 iterations
    // Should still be at 100 at iteration 20, then transition
    let transitioned = false
    for (let i = 0; i < 25; i++) {
      if (shortSteady.next() !== 100) {
        transitioned = true
        break
      }
    }
    assert.ok(transitioned, 'expected short steady phase to transition before iteration 25')
  })

  it('should have shorter spike with smaller spike value', () => {
    // spike=10 means transition takes exactly 10 iterations
    // steady=5 means steady phase is 5 iterations
    const fastSpike = new TrafficGenerator({ min: 100, max: 1000, noise: 0, steady: 5, spike: 10 })
    // Get through steady phase (5 iterations) then spike completes in 10
    const values = []
    for (let i = 0; i < 20; i++) {
      values.push(fastSpike.next())
    }
    const maxVal = Math.max(...values)
    assert.ok(maxVal > 500, `expected to reach high values with fast spike, max was ${maxVal}`)
  })

  it('should handle very large spike duration', () => {
    const generator = new TrafficGenerator({ min: 100, max: 1000, noise: 0, steady: 55, spike: 200 })
    for (let i = 0; i < 500; i++) {
      const value = generator.next()
      assert.ok(value >= 100 && value <= 1000)
    }
  })
})
