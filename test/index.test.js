'use strict'

const { describe, it, after } = require('node:test')
const assert = require('node:assert/strict')
const { createServer } = require('node:http')
const httpFire = require('../index')
const { RequestError } = require('../index')

function startServer (handler) {
  return new Promise((resolve) => {
    const server = createServer(handler || ((req, res) => {
      res.writeHead(200)
      res.end('ok')
    }))
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      resolve({ server, url: `http://127.0.0.1:${port}` })
    })
  })
}

function wait (ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('httpFire', () => {
  it('should export a function', () => {
    assert.equal(typeof httpFire, 'function')
  })

  it('should export RequestError', () => {
    assert.equal(typeof RequestError, 'function')
  })

  it('should export httpFire as named export', () => {
    assert.equal(httpFire.httpFire, httpFire)
  })

  it('should throw if url is missing', () => {
    assert.throws(() => httpFire({}), { message: 'url is required' })
  })

  it('should return an instance with stop, currentRate, targetRate, setRate', async () => {
    const { server, url } = await startServer()
    const instance = httpFire({ url })
    after(() => { instance.stop(); server.close() })

    assert.equal(typeof instance.stop, 'function')
    assert.equal(typeof instance.setRate, 'function')
    assert.equal(typeof instance.currentRate, 'number')
    assert.equal(typeof instance.targetRate, 'number')
  })

  it('should send traffic and report via onTick', async () => {
    const { server, url } = await startServer()
    let reported = null
    const instance = httpFire({
      url,
      onTick: (actual) => { reported = actual }
    })
    after(() => { instance.stop(); server.close() })

    await wait(2500)

    assert.ok(reported !== null)
    assert.ok(reported > 0)
    assert.ok(instance.targetRate > 0)
  })

  it('should report errors via onError', async () => {
    const { server, url } = await startServer((req, res) => {
      res.writeHead(500)
      res.end('server error')
    })

    let receivedError = null
    const instance = httpFire({
      url,
      onError: (err) => { receivedError = err }
    })
    after(() => { instance.stop(); server.close() })

    await wait(2500)

    assert.ok(receivedError instanceof RequestError)
    assert.equal(receivedError.statusCode, 500)
  })

  it('should stop cleanly', async () => {
    const { server, url } = await startServer()
    const instance = httpFire({ url })

    await wait(500)
    instance.stop()
    server.close()

    assert.equal(instance.currentRate, 0)
  })
})
