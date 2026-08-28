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
  "workers": 10,
  "profile": "ramp",
  "rampMs": 10000,
  "holdMs": 0,
  "count": 0,
  "rps": 0,
  "timeoutMs": 10000,
  "followRedirects": true,
  "abortErrorPct": 20,
  "abortP95Ms": 0,
  "abortConsecutive": 30,
  "abortAfter": 20,
  "abortGraceMs": 2000
}
```

`profile`: `constant` (all workers at once, `durationMs` / `count`), `ramp` (0 → peak over `rampMs`, then stop), `hold` (warmup `rampMs`, then keep peak for `holdMs`).

Abort (0 = off): error rate %, p95 ms, consecutive failures. Evaluated after `abortGraceMs` and at least `abortAfter` requests. Status `aborted` with `abort` = `error_rate` | `p95` | `consecutive`.

Snapshot: phase, desiredWorkers, totals, errorRate, RPS, latency percentiles, status histogram.

Caps: 200 workers, 600s, 1e6 requests, 10k RPS.

```bash
go test -C loadtest .
```
