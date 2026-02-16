#!/usr/bin/env node

'use strict'

const { parseArgs } = require('node:util')
const { readFileSync } = require('node:fs')
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
    header: { type: 'string', short: 'H', multiple: true },
    body: { type: 'string', short: 'b' },
    input: { type: 'string', short: 'i' },
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
  console.error('  --header, -H    HTTP header in "Key: Value" format (repeatable)')
  console.error('  --body, -b      Request body string')
  console.error('  --input, -i     Read request body from file')
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

let headers
if (values.header) {
  headers = values.header.reduce((obj, header) => {
    const colonIndex = header.indexOf(':')
    const equalIndex = header.indexOf('=')
    const index = Math.min(colonIndex < 0 ? Infinity : colonIndex, equalIndex < 0 ? Infinity : equalIndex)
    if (Number.isFinite(index) && index > 0) {
      obj[header.slice(0, index).trim()] = header.slice(index + 1).trim()
      return obj
    } else {
      throw new Error(`An HTTP header was not correctly formatted: ${header}`)
    }
  }, {})
}

console.log('Starting traffic generator:')
console.log('  URL: ' + values.url)
console.log('  Method: ' + method.toUpperCase())
console.log('  Min: ' + trafficConfig.min + ' req/s')
console.log('  Max: ' + trafficConfig.max + ' req/s')
console.log('  Noise: ' + trafficConfig.noise)
console.log('  Steady: ' + trafficConfig.steady + 's')
console.log('  Spike: ' + trafficConfig.spike + 's')

let body
if (values.input) {
  body = readFileSync(values.input, 'utf8')
} else if (values.body) {
  body = values.body
}


if (headers) {
  for (const [key, value] of Object.entries(headers)) {
    console.log('  Header: ' + key + ': ' + value)
  }
}

if (body) {
  console.log('  Body: ' + (body.length > 50 ? body.slice(0, 50) + '...' : body))
}

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
    headers,
    body,
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
