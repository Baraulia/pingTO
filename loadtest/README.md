# PingTo loadtest agent

Local HTTP load generator. The Chrome extension cannot open thousands of connections; this process can.

**Users:** in PingTo (Pro) open **Load test** and download the agent for this OS from the official catalog (GitHub Release). Do not take the file from chat. Windows: run the `.exe`. macOS/Linux: `chmod +x` then `./pingto-loadtest-…`.

**Developers:**

```bash
npm run build:loadtest
go run -C loadtest .
```

Tag `v*` → `.github/workflows/loadtest-release.yml` uploads six binaries and `dist/loadtest/latest.json` (SHA-256 + URLs).

Listens on `http://127.0.0.1:8788` (override `PINGTO_LOADTEST_ADDR` or `-addr`). Loopback only by default.

## API

| Method | Path | Meaning |
|--------|------|---------|
| GET | `/health` | `{ ok, service, version }` |
| POST | `/v1/runs` | Start a run, body = spec |
| GET | `/v1/runs/{id}` | Snapshot |
| GET | `/v1/runs/{id}/events` | SSE snapshots (~200ms) |
| POST | `/v1/runs/{id}/stop` | Cancel |

Spec JSON:

```json
{
  "method": "GET",
  "url": "http://127.0.0.1:8787/health",
  "headers": { "Accept": "application/json" },
  "body": "",
  "workers": 0,
  "profile": "ramp",
  "rampMs": 10000,
  "holdMs": 0,
  "count": 0,
  "rps": 0,
  "timeoutMs": 10000,
  "followRedirects": true,
  "abortErrorPct": 20,
  "abortP95Ms": 0,
  "abortConsecutive": 0,
  "abortAfter": 20,
  "abortGraceMs": 2000
}
```

`profile`: `constant` (full auto-sized pool at once, `durationMs` / `count`), `ramp` (0 → peak RPS over `rampMs`, then stop), `hold` (warmup `rampMs`, then keep peak for `holdMs`). `workers` is optional: `0` or omitted means the agent sizes the pool from target RPS (or from 10k RPS if uncapped).

Abort (0 = off): error rate %, p95 ms, consecutive HTTP 4xx/5xx or timeouts (connection refused/reset does not count toward the streak; it still counts in Failures and error rate). Evaluated after `abortGraceMs` and at least `abortAfter` requests. Status `aborted` with `abort` = `error_rate` | `p95` | `consecutive`. Status histogram includes `0` for transport errors (no HTTP status).

Snapshot: phase, desiredWorkers, totals, errorRate, `rps` (average over the run), `rpsLive` (last 1 s), `rpsMax` (peak of the 1 s window), latency percentiles, status histogram. Compensations: `compensateOk` / `compensateFail` (not counted in RPS).

## Ammo and compensation

Works for **POST, DELETE, PUT, PATCH** (any allowed method). The current request is the default cartridge; ammo overrides per shot.

- `ammo`: JSON array, max 2000. A string is `{ "body": "..." }`. Object fields: `method`, `url`, `headers`, `body`, `compensate`. Omitted fields inherit the current request.
- `{n}` in URL or body → 1-based shot index for this run (not unique across runs).
- `ammoMode`: `roundrobin` (default) or `random`.
- `compensate` on a **cartridge**: second request after a **successful** main shot. Put restore **body** here — one global body cannot describe thousands of different ids.
- Spec-level `compensate`: only `method` + `url` with `{n}` (typical: POST create → `DELETE /v1/users/{n}`). No body. Cartridge `compensate` overrides it.

POST create then delete:

```json
[{
  "body": "{\"id\":\"{n}\",\"email\":\"user-{n}@load.test\",\"name\":\"User {n}\"}",
  "compensate": { "method": "DELETE", "url": "http://127.0.0.1:8787/v1/users/{n}" }
}]
```

DELETE a pool, then restore each row (round-robin the same ids):

```json
[
  {
    "method": "DELETE",
    "url": "http://127.0.0.1:8787/v1/sessions/s-alpha",
    "compensate": {
      "method": "POST",
      "url": "http://127.0.0.1:8787/v1/sessions",
      "body": "{\"id\":\"s-alpha\",\"user\":\"alpha\"}"
    }
  },
  {
    "method": "DELETE",
    "url": "http://127.0.0.1:8787/v1/sessions/s-beta",
    "compensate": {
      "method": "POST",
      "url": "http://127.0.0.1:8787/v1/sessions",
      "body": "{\"id\":\"s-beta\",\"user\":\"beta\"}"
    }
  }
]
```

DELETE pre-seeded `1…N` (only user `42` exists until you create others, else 404): `[{"url":"http://127.0.0.1:8787/v1/users/{n}"}]`.

Check leftovers: `GET http://127.0.0.1:8787/v1/stats`. Reseed: `POST /v1/reset`.

Compensation is best-effort, not a transaction. Failed restore leaves a hole in the pool. Prefer GET when you only need throughput.

Caps: target RPS up to 1e6, 500k in-flight (OOM guard only), 600s, 1e6 request count, 2000 ammo. POST `/v1/runs` body up to 8 MiB.

When `rps` is set, the agent **starts** requests at that rate (open-loop). In-flight count is not a user setting — it grows with latency (Little’s law). The 500k ceiling exists only so a wedged server cannot spawn unbounded goroutines. A single process on one PC will not actually sustain 1e6 HTTP req/s; that number is the asked rate, not a promise.

Logs at process start are English and spell out loopback-only bind, no auth, no telemetry, and that load is generated only after a local POST.

```bash
go test -C loadtest .
```
