'use strict'

const { TrafficGenerator } = require('./lib/traffic-generator')
const { TrafficRunner, RequestError } = require('./lib/traffic-runner')

const DEFAULTS = {
  min: 100,
  max: 1000,
  noise: 0.1,
  steady: 55,
  spike: 60,
  method: 'GET'
}

function httpFire (opts = {}) {
  if (!opts.url) {
    throw new Error('url is required')
  }

  const min = opts.min || DEFAULTS.min
  const max = opts.max || DEFAULTS.max
  const noise = opts.noise ?? DEFAULTS.noise
  const steady = opts.steady || DEFAULTS.steady
  const spike = opts.spike || DEFAULTS.spike

  const generator = new TrafficGenerator({ min, max, noise, steady, spike })
  const runner = new TrafficRunner(opts.url, opts.onTick, {
    method: opts.method || DEFAULTS.method,
    headers: opts.headers,
    body: opts.body,
    rejectUnauthorized: opts.rejectUnauthorized,
    onError: opts.onError
  })

  let targetRate = 0
  const interval = setInterval(() => {
    targetRate = generator.next()
    runner.setRate(targetRate)
  }, 1000)

  return {
    stop () {
      clearInterval(interval)
      runner.stop()
    },
    get currentRate () {
      return runner.currentRate
    },
    get targetRate () {
      return targetRate
    },
    setRate (rps) {
      runner.setRate(rps)
    }
  }
}

module.exports = httpFire
module.exports.httpFire = httpFire
module.exports.RequestError = RequestError
