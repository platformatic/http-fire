'use strict'

const { TrafficGenerator } = require('./lib/traffic-generator')
const { TrafficRunner, RequestError } = require('./lib/traffic-runner')

module.exports = { TrafficGenerator, TrafficRunner, RequestError }
