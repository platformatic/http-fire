# http-fire

HTTP traffic generator with realistic variable load patterns. Used as a CLI tool (`fire`) and programmatically via `httpFire(opts)`.

## Project structure

```
index.js                  Public API — httpFire() function, the only public export
lib/traffic-generator.js  TrafficGenerator class (internal) — generates RPS pattern
lib/traffic-runner.js     TrafficRunner class (internal) — dispatches HTTP requests via undici
                          RequestError class — custom error with optional statusCode
bin/traffic.js            CLI entry point — parses args, calls httpFire()
test/                     Node.js built-in test runner (node --test)
```

## Architecture

- `httpFire(opts)` is the public API. It wires TrafficGenerator + TrafficRunner together and returns `{ stop, setRate, currentRate, targetRate }`.
- TrafficGenerator and TrafficRunner are internal classes, not exported from the public API. Tests can import them directly from `lib/`.
- The default export is the function itself: `module.exports = httpFire`. Named export also available: `module.exports.httpFire = httpFire`.
- `RequestError` is the only class exported publicly, for `instanceof` checks in `onError`.

## Traffic generation algorithm

Three phases cycle: STEADY -> SPIKE -> STEADY -> DROP -> STEADY -> ...

- **Steady**: holds at current value for `steady` seconds (config)
- **Spike**: sigmoid transition up to 60-100% of range over `spike` seconds
- **Drop**: sigmoid transition down to 0-40% of range over `spike` seconds
- Phase direction (spike vs drop) is chosen based on whether current value is below or above midpoint
- Sigmoid steepness is auto-derived from spike duration: `k = max(1, 20 - spike/6)`
- Gaussian noise (Box-Muller transform) applied proportional to current value and noise factor

## Request dispatch

- Requests are fired every 100ms in ticks of `ceil(rate / 10)` requests
- `onTick` callback fires every 1 second with the count of dispatched requests
- Response bodies are consumed via `res.body.text()` to free sockets
- Non-2xx responses and connection errors both go to `onError` as `RequestError`
- Uses undici for HTTP with optional custom Agent for `rejectUnauthorized: false`

## Conventions

- CommonJS (`require`/`module.exports`)
- No semicolons (standard style)
- Node.js >= 18
- Tests use `node:test` built-in runner with `node:assert/strict`
- Run tests: `npm test`
- Single dependency: `undici`
