'use strict'

const { request, Agent } = require('undici')

class RequestError extends Error {
  constructor (message, statusCode) {
    super(message)
    this.name = 'RequestError'
    if (statusCode !== undefined) {
      this.statusCode = statusCode
    }
  }
}

class TrafficRunner {
  #url
  #method
  #currentRate
  #onTraffic
  #onError
  #requestsThisSecond
  #trafficInterval
  #reportInterval
  #dispatcher

  constructor (url, onTraffic, options = {}) {
    this.#url = url
    this.#method = (options.method || 'GET').toUpperCase()
    this.#currentRate = 0
    this.#onTraffic = onTraffic || (() => {})
    this.#onError = options.onError || (() => {})
    this.#requestsThisSecond = 0
    this.#trafficInterval = null
    this.#reportInterval = null
    this.#dispatcher = options.rejectUnauthorized === false
      ? new Agent({ connect: { rejectUnauthorized: false } })
      : undefined

    this.#startIntervals()
  }

  #startIntervals () {
    // Fire requests every 100ms based on current rate
    this.#trafficInterval = setInterval(() => {
      if (this.#currentRate <= 0) return

      const requestsThisTick = Math.ceil(this.#currentRate / 10)
      for (let i = 0; i < requestsThisTick; i++) {
        this.#sendRequest()
        this.#requestsThisSecond++
      }
    }, 100)

    // Report actual traffic every second
    this.#reportInterval = setInterval(() => {
      this.#onTraffic(this.#requestsThisSecond)
      this.#requestsThisSecond = 0
    }, 1000)
  }

  async #sendRequest () {
    try {
      const res = await request(this.#url, {
        method: this.#method,
        dispatcher: this.#dispatcher
      })

      const body = await res.body.text()
      if (res.statusCode < 200 || res.statusCode >= 300) {
        this.#onError(new RequestError(body, res.statusCode))
      }
    } catch (err) {
      this.#onError(new RequestError(err.message))
    }
  }

  setRate (rps) {
    this.#currentRate = rps
  }

  stop () {
    this.#currentRate = 0
    if (this.#trafficInterval) {
      clearInterval(this.#trafficInterval)
      this.#trafficInterval = null
    }
    if (this.#reportInterval) {
      clearInterval(this.#reportInterval)
      this.#reportInterval = null
    }
  }

  get currentRate () {
    return this.#currentRate
  }
}

module.exports = { TrafficRunner, RequestError }
