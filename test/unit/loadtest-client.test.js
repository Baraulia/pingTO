import { describe, expect, it } from 'vitest';
import { clampLoadSpec, DEFAULT_LOADTEST_AGENT, formatLoadReport, loadProgressPct, mixShares, normalizeAgentUrl, pushLoadSample, sparklinePoints } from '../../modules/loadtest-client.js';

describe('loadtest-client', () => {
  it('normalizes agent origin', () => {
    expect(normalizeAgentUrl('http://127.0.0.1:8788/')).toBe('http://127.0.0.1:8788');
    expect(normalizeAgentUrl('nope')).toBe(DEFAULT_LOADTEST_AGENT);
  });

  it('clamps workers duration and applies duration default', () => {
    const spec = clampLoadSpec({ workers: 999, url: 'http://x', method: 'post' });
    expect(spec.workers).toBe(200);
    expect(spec.durationMs).toBe(10000);
    expect(spec.method).toBe('POST');
    expect(clampLoadSpec({ count: 5, durationMs: 0 }).durationMs).toBe(0);
    expect(clampLoadSpec({ count: 5, durationMs: 0 }).count).toBe(5);
  });

  it('maps ramp and hold profiles', () => {
    const ramp = clampLoadSpec({ profile: 'ramp', rampMs: 8000, workers: 20 });
    expect(ramp.profile).toBe('ramp');
    expect(ramp.durationMs).toBe(8000);
    expect(ramp.holdMs).toBe(0);
    const hold = clampLoadSpec({ profile: 'hold' });
    expect(hold.rampMs).toBe(1000);
    expect(hold.holdMs).toBe(10000);
    expect(hold.durationMs).toBe(11000);
  });

  it('formats a readable report', () => {
    const text = formatLoadReport({
      status: 'aborted',
      abort: 'error_rate',
      phase: 'ramp',
      elapsedMs: 1200,
      desiredWorkers: 4,
      spec: { workers: 10 },
      total: 100,
      ok: 50,
      fail: 40,
      timeout: 10,
      errorRate: 0.5,
      rps: 80,
      bytesIn: 2048,
      latency: { minMs: 1, avgMs: 10, p50Ms: 8, p95Ms: 20, p99Ms: 40, maxMs: 50 },
      statusCodes: { 200: 50, 503: 40 },
    }, (k) => k);
    expect(text).toContain('loadAbort_error_rate');
    expect(text).toContain('503: 40');
  });

  it('builds sparkline samples and mix shares', () => {
    const hist = pushLoadSample([], { elapsedMs: 100, rps: 10, errorRate: 0.2, desiredWorkers: 3, latency: { p50Ms: 1, p95Ms: 5, p99Ms: 9 } });
    expect(hist).toHaveLength(1);
    expect(hist[0].err).toBe(20);
    expect(sparklinePoints([0, 50, 100], 100, 50, 100)).toContain('97.0,3.0');
    expect(mixShares(70, 20, 10)).toEqual({ ok: 70, fail: 20, timeout: 10 });
    expect(loadProgressPct({ elapsedMs: 2500, spec: { durationMs: 10000 } })).toBe(25);
  });
});
