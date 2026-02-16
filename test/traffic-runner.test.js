'use strict'

const { describe, it, after } = require('node:test')
const assert = require('node:assert/strict')
const { createServer } = require('node:http')
const { TrafficRunner, RequestError } = require('../lib/traffic-runner')

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

describe('TrafficRunner', () => {
  it('should start with rate 0', async () => {
    const { server, url } = await startServer()
    const runner = new TrafficRunner(url, () => {})
    after(() => { runner.stop(); server.close() })

    assert.equal(runner.currentRate, 0)
  })

  it('should update rate with setRate', async () => {
    const { server, url } = await startServer()
    const runner = new TrafficRunner(url, () => {})
    after(() => { runner.stop(); server.close() })

    runner.setRate(100)
    assert.equal(runner.currentRate, 100)

    runner.setRate(500)
    assert.equal(runner.currentRate, 500)
  })

  it('should reset rate to 0 on stop', async () => {
    const { server, url } = await startServer()
    const runner = new TrafficRunner(url, () => {})

    runner.setRate(100)
    runner.stop()
    server.close()
    assert.equal(runner.currentRate, 0)
  })

  it('should send requests and report traffic via callback', async () => {
    const { server, url } = await startServer()
    let reportedTraffic = null
    const runner = new TrafficRunner(url, (actual) => {
      reportedTraffic = actual
    })
    after(() => { runner.stop(); server.close() })

    runner.setRate(50)
    await wait(1500)

    assert.ok(reportedTraffic !== null, 'expected onTraffic callback to be called')
    assert.ok(reportedTraffic > 0, `expected traffic > 0, got ${reportedTraffic}`)
  })

  it('should not send requests when rate is 0', async () => {
    const { server, url } = await startServer()
    let reportedTraffic = null
    const runner = new TrafficRunner(url, (actual) => {
      reportedTraffic = actual
    })
    after(() => { runner.stop(); server.close() })

    await wait(1500)

    assert.equal(reportedTraffic, 0)
  })

  it('should call onError with RequestError for non-2xx responses', async () => {
    const { server, url } = await startServer((req, res) => {
      res.writeHead(500)
      res.end('server error')
    })

    let receivedError = null
    const runner = new TrafficRunner(url, () => {}, {
      onError: (err) => { receivedError = err }
    })
    after(() => { runner.stop(); server.close() })

    runner.setRate(10)
    await wait(1500)

    assert.ok(receivedError instanceof RequestError)
    assert.equal(receivedError.statusCode, 500)
    assert.equal(receivedError.message, 'server error')
  })

  it('should call onError with RequestError for connection errors', async () => {
    let receivedError = null
    const runner = new TrafficRunner('http://127.0.0.1:1', () => {}, {
      onError: (err) => { receivedError = err }
    })
    after(() => runner.stop())

    runner.setRate(10)
    await wait(1500)

    assert.ok(receivedError instanceof RequestError)
    assert.equal(receivedError.statusCode, undefined)
    assert.ok(receivedError.message.length > 0)
  })

  it('should stop sending requests after stop()', async () => {
    let requestCount = 0
    const { server, url } = await startServer((req, res) => {
      requestCount++
      res.writeHead(200)
      res.end('ok')
    })
    after(() => server.close())

    const runner = new TrafficRunner(url, () => {})

    runner.setRate(50)
    await wait(500)
    runner.stop()

    const countAtStop = requestCount
    await wait(500)

    assert.ok(
      requestCount - countAtStop <= 5,
      `expected no new requests after stop, but got ${requestCount - countAtStop} more`
    )
  })

  it('should scale request rate approximately', async () => {
    const { server, url } = await startServer()
    const reports = []
    const runner = new TrafficRunner(url, (actual) => {
      reports.push(actual)
    })
    after(() => { runner.stop(); server.close() })

    runner.setRate(100)
    await wait(3500)

    assert.ok(reports.length >= 3, `expected at least 3 reports, got ${reports.length}`)
    for (const r of reports.slice(-2)) {
      assert.ok(r >= 50 && r <= 200, `expected ~100 req/s, got ${r}`)
    }
  })

  it('should use GET method by default', async () => {
    let receivedMethod = null
    const { server, url } = await startServer((req, res) => {
      receivedMethod = req.method
      res.writeHead(200)
      res.end('ok')
    })
    const runner = new TrafficRunner(url, () => {})
    after(() => { runner.stop(); server.close() })

    runner.setRate(10)
    await wait(500)

    assert.equal(receivedMethod, 'GET')
  })

  it('should use configured HTTP method', async () => {
    let receivedMethod = null
    const { server, url } = await startServer((req, res) => {
      receivedMethod = req.method
      res.writeHead(200)
      res.end('ok')
    })
    const runner = new TrafficRunner(url, () => {}, { method: 'POST' })
    after(() => { runner.stop(); server.close() })

    runner.setRate(10)
    await wait(500)

    assert.equal(receivedMethod, 'POST')
  })

  it('should normalize method to uppercase', async () => {
    let receivedMethod = null
    const { server, url } = await startServer((req, res) => {
      receivedMethod = req.method
      res.writeHead(200)
      res.end('ok')
    })
    const runner = new TrafficRunner(url, () => {}, { method: 'put' })
    after(() => { runner.stop(); server.close() })

    runner.setRate(10)
    await wait(500)

    assert.equal(receivedMethod, 'PUT')
  })

  it('should send custom headers', async () => {
    let receivedHeaders = null
    const { server, url } = await startServer((req, res) => {
      receivedHeaders = req.headers
      res.writeHead(200)
      res.end('ok')
    })
    const runner = new TrafficRunner(url, () => {}, {
      headers: {
        'X-Custom-Header': 'test-value',
        Authorization: 'Bearer token123'
      }
    })
    after(() => { runner.stop(); server.close() })

    runner.setRate(10)
    await wait(500)

    assert.ok(receivedHeaders, 'expected headers to be received')
    assert.equal(receivedHeaders['x-custom-header'], 'test-value')
    assert.equal(receivedHeaders.authorization, 'Bearer token123')
  })

  it('should send request body', async () => {
    let receivedBody = ''
    const { server, url } = await startServer((req, res) => {
      let data = ''
      req.on('data', (chunk) => { data += chunk })
      req.on('end', () => {
        receivedBody = data
        res.writeHead(200)
        res.end('ok')
      })
    })
    const runner = new TrafficRunner(url, () => {}, {
      method: 'POST',
      body: '{"key":"value"}'
    })
    after(() => { runner.stop(); server.close() })

    runner.setRate(10)
    await wait(500)

    assert.equal(receivedBody, '{"key":"value"}')
  })

  it('should send headers and body together', async () => {
    let receivedHeaders = null
    let receivedBody = ''
    const { server, url } = await startServer((req, res) => {
      receivedHeaders = req.headers
      let data = ''
      req.on('data', (chunk) => { data += chunk })
      req.on('end', () => {
        receivedBody = data
        res.writeHead(200)
        res.end('ok')
      })
    })
    const runner = new TrafficRunner(url, () => {}, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"hello":"world"}'
    })
    after(() => { runner.stop(); server.close() })

    runner.setRate(10)
    await wait(500)

    assert.equal(receivedHeaders['content-type'], 'application/json')
    assert.equal(receivedBody, '{"hello":"world"}')
  })

  it('should work without headers and body options', async () => {
    let receivedHeaders = null
    const { server, url } = await startServer((req, res) => {
      receivedHeaders = req.headers
      res.writeHead(200)
      res.end('ok')
    })
    const runner = new TrafficRunner(url, () => {})
    after(() => { runner.stop(); server.close() })

    runner.setRate(10)
    await wait(500)

    assert.ok(receivedHeaders, 'expected headers to be received')
    assert.ok(!receivedHeaders['content-type'], 'expected no content-type header')
  })
})
