#!/usr/bin/env node

'use strict'

const { parseArgs } = require('node:util')
const { TrafficGenerator } = require('../lib/traffic-generator')
const { TrafficRunner } = require('../lib/traffic-runner')

const DEFAULTS = {
  min: 100,
  max: 1000,
  noise: 0.1,
  steady: 55,
  spike: 60,
  method: 'GET'
}

const { values } = parseArgs({
  options: {
    url: { type: 'string', short: 'u' },
    min: { type: 'string' },
    max: { type: 'string' },
    noise: { type: 'string', short: 'n' },
    steady: { type: 'string' },
    spike: { type: 'string' },
    method: { type: 'string', short: 'X' },
    insecure: { type: 'boolean', short: 'k', default: false }
  }
})

if (!values.url) {
  console.error('Usage: http-fire --url <url> [options]')
  console.error('')
  console.error('Options:')
  console.error('  --url, -u       Target URL to send traffic to (required)')
  console.error('  --min           Minimum requests per second (default: ' + DEFAULTS.min + ')')
  console.error('  --max           Maximum requests per second (default: ' + DEFAULTS.max + ')')
  console.error('  --noise, -n     Noise factor 0-1 (default: ' + DEFAULTS.noise + ')')
  console.error('  --steady        Steady phase duration in seconds (default: ' + DEFAULTS.steady + ')')
  console.error('  --spike         Spike/drop transition duration in seconds (default: ' + DEFAULTS.spike + ')')
  console.error('  --method, -X    HTTP method (default: ' + DEFAULTS.method + ')')
  console.error('  --insecure, -k  Skip TLS certificate verification')
  process.exit(1)
}

const trafficConfig = {
  min: values.min ? parseInt(values.min, 10) : DEFAULTS.min,
  max: values.max ? parseInt(values.max, 10) : DEFAULTS.max,
  noise: values.noise ? parseFloat(values.noise) : DEFAULTS.noise,
  steady: values.steady ? parseInt(values.steady, 10) : DEFAULTS.steady,
  spike: values.spike ? parseInt(values.spike, 10) : DEFAULTS.spike
}

const method = values.method || DEFAULTS.method

console.log('Starting traffic generator:')
console.log('  URL: ' + values.url)
console.log('  Method: ' + method.toUpperCase())
console.log('  Min: ' + trafficConfig.min + ' req/s')
console.log('  Max: ' + trafficConfig.max + ' req/s')
console.log('  Noise: ' + trafficConfig.noise)
console.log('  Steady: ' + trafficConfig.steady + 's')
console.log('  Spike: ' + trafficConfig.spike + 's')
if (values.insecure) {
  console.log('  TLS verification: disabled')
}
console.log('')

const trafficGenerator = new TrafficGenerator(trafficConfig)
const trafficRunner = new TrafficRunner(
  values.url,
  (actualTraffic) => {
    process.stdout.write('\rTarget: ' + targetRate + ' req/s | Actual: ' + actualTraffic + ' req/s    ')
  },
  {
    method,
    rejectUnauthorized: values.insecure ? false : undefined,
    onError: (err) => {
      if (err.statusCode) {
        console.error('\nHTTP error ' + err.statusCode + ': ' + err.message)
      } else {
        console.error('\nRequest error: ' + err.message)
      }
    }
  }
)

let targetRate = 0
setInterval(() => {
  targetRate = trafficGenerator.next()
  trafficRunner.setRate(targetRate)
}, 1000)

process.on('SIGINT', () => {
  console.log('\nStopping traffic generator...')
  trafficRunner.stop()
  process.exit(0)
})
