# @platformatic/http-fire

HTTP traffic generator with realistic traffic patterns. Generates variable load with spikes, drops, and steady phases using sigmoid transitions and Gaussian noise.

Works as a CLI tool and programmatically.

## Install

```bash
npm install @platformatic/http-fire
```

## CLI

```bash
fire --url http://localhost:3000
```

Output:

```
Starting traffic generator:
  URL: http://localhost:3000
  Method: GET
  Min: 100 req/s
  Max: 1000 req/s
  Noise: 0.1
  Steady: 55s
  Spike: 60s

Target: 342 req/s | Actual: 340 req/s
```

### Options

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--url` | `-u` | Target URL (required) | |
| `--min` | | Minimum requests per second | `100` |
| `--max` | | Maximum requests per second | `1000` |
| `--noise` | `-n` | Noise factor 0-1 | `0.1` |
| `--steady` | | Steady phase duration in seconds | `55` |
| `--spike` | | Spike/drop transition duration in seconds | `60` |
| `--method` | `-X` | HTTP method | `GET` |
| `--header` | `-H` | HTTP header in `Key: Value` format (repeatable) | |
| `--body` | `-b` | Request body string | |
| `--input` | `-i` | Read request body from file | |
| `--insecure` | `-k` | Skip TLS certificate verification | `false` |

### Examples

```bash
# Basic GET traffic
fire --url http://localhost:3000

# POST with custom headers and body
fire --url http://localhost:3000/api \
  -X POST \
  -H "Content-Type: application/json" \
  -b '{"key": "value"}'

# High-frequency spiky traffic with noise
fire --url http://localhost:3000 \
  --min 500 --max 5000 --noise 0.3 --spike 20

# Long steady periods, slow transitions
fire --url http://localhost:3000 \
  --steady 120 --spike 90

# Skip TLS verification
fire --url https://localhost:3443 -k
```

## Programmatic API

```js
const httpFire = require('@platformatic/http-fire')

const instance = httpFire({
  url: 'http://localhost:3000',
  min: 100,
  max: 1000,
  onTick: (requestCount) => {
    console.log(`Sent ${requestCount} requests in the last second`)
  }
})

// Later...
instance.stop()
```

### `httpFire(opts)`

Returns an instance that immediately starts generating traffic.

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `url` | `string` | Target URL (required) | |
| `min` | `number` | Minimum requests per second | `100` |
| `max` | `number` | Maximum requests per second | `1000` |
| `noise` | `number` | Noise factor 0-1. Higher values add more randomness. | `0.1` |
| `steady` | `number` | Duration (seconds) the traffic holds at a level before changing | `55` |
| `spike` | `number` | Duration (seconds) for a spike or drop transition | `60` |
| `method` | `string` | HTTP method | `GET` |
| `headers` | `object` | HTTP headers | |
| `body` | `string` | Request body | |
| `rejectUnauthorized` | `boolean` | Set to `false` to skip TLS verification | |
| `onTick` | `function` | Called every second with the number of requests dispatched | |
| `onError` | `function` | Called with a `RequestError` on HTTP or connection errors | |

#### Instance

| Property/Method | Description |
|----------------|-------------|
| `instance.stop()` | Stop all traffic and clean up |
| `instance.setRate(rps)` | Override the generated rate manually |
| `instance.targetRate` | Current target rate from the traffic generator |
| `instance.currentRate` | Current dispatched rate |

### `RequestError`

```js
const { RequestError } = require('@platformatic/http-fire')
```

Errors passed to `onError` are `RequestError` instances with:

- `message` — response body for HTTP errors, or error message for connection errors
- `statusCode` — HTTP status code (only present for HTTP errors, absent for connection errors)

```js
httpFire({
  url: 'http://localhost:3000',
  onError: (err) => {
    if (err.statusCode) {
      console.error(`HTTP ${err.statusCode}: ${err.message}`)
    } else {
      console.error(`Connection error: ${err.message}`)
    }
  }
})
```

## How the traffic pattern works

The generator cycles through three phases:

1. **Steady** — holds at a constant rate for `steady` seconds
2. **Spike** — smoothly ramps up to 60-100% of the range over `spike` seconds
3. **Drop** — smoothly ramps down to 0-40% of the range over `spike` seconds

Transitions use a sigmoid curve for realistic gradual changes. The `noise` parameter adds Gaussian randomness proportional to the current rate.

```
Rate
 ^
 |          ___________
 |         /           \
 |        /             \
 |  _____/               \____
 |                             \________
 +-----------------------------------------> Time
   steady  spike   steady  drop   steady
```

## License

Apache-2.0
