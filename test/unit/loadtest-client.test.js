import { describe, expect, it } from 'vitest';
import { buildLoadReportHtml, clampLoadSpec, DEFAULT_LOADTEST_AGENT, formatLoadReport, formatMs, formatStatusCodeLabel, loadProgressPct, mixShares, niceCeiling, formatChartNum, formatChartTime, normalizeAgentUrl, parseAmmoJson, parseCompensate, pushLoadSample, sparklinePoints } from '../../modules/loadtest-client.js';

describe('loadtest-client', () => {
  it('normalizes agent origin', () => {
    expect(normalizeAgentUrl('http://127.0.0.1:8788/')).toBe('http://127.0.0.1:8788');
    expect(normalizeAgentUrl('nope')).toBe(DEFAULT_LOADTEST_AGENT);
  });

  it('applies duration default and ignores workers', () => {
    const spec = clampLoadSpec({ workers: 999, url: 'http://x', method: 'post' });
    expect(spec.workers).toBeUndefined();
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
      statusCodes: { 200: 50, 503: 40, 0: 7 },
    }, (k) => k);
    expect(text).toContain('loadAbort_error_rate');
    expect(text).toContain('503: 40');
    expect(text).toContain('loadReportCodeNet: 7');
    expect(formatStatusCodeLabel('0', (k) => k)).toBe('loadReportCodeNet');
    expect(formatStatusCodeLabel(200)).toBe('200');
    expect(text).toContain('loadReportRpsAvg');
    expect(formatMs(0.04)).toBe('0.040');
    expect(formatMs(1.6)).toBe('1.60');
    expect(text).toContain('loadReportRpsMax');
  });

  it('parses ammo and builds html with svg', () => {
    expect(parseAmmoJson('["a","b"]')).toEqual([{ body: 'a' }, { body: 'b' }]);
    const del = parseAmmoJson('[{"method":"DELETE","url":"http://x/s-alpha","compensate":{"method":"POST","url":"http://x/sessions","body":"{\\"id\\":\\"s-alpha\\"}"}}]');
    expect(del[0].method).toBe('DELETE');
    expect(del[0].compensate.body).toContain('s-alpha');
    expect(parseCompensate('POST', '')).toBeNull();
    expect(parseCompensate('POST', 'http://x/v1/users/{n}')).toEqual({ method: 'POST', url: 'http://x/v1/users/{n}' });
    const html = buildLoadReportHtml(
      { status: 'done', rps: 10, rpsMax: 40, spec: { rps: 100 }, latency: {} },
      [{ t: 0, rps: 1, p50: 1, p95: 2, p99: 3, err: 0, clients: 2 }, { t: 5000, rps: 80, p50: 4, p95: 8, p99: 12, err: 1, clients: 10 }],
      (k) => k
    );
    expect(html).toContain('<svg');
    expect(html).toContain('loadReportCharts');
    expect(html).toContain('loadChartAxisRps');
    expect(html).toContain('loadChartAxisTime');
    expect(html).toContain('5s');
    expect(html).toContain('loadChartTarget');
    expect(html).toContain('p95');
  });

  it('builds sparkline samples and mix shares', () => {
    const hist = pushLoadSample([], { elapsedMs: 100, rps: 10, errorRate: 0.2, desiredWorkers: 3, latency: { p50Ms: 1, p95Ms: 5, p99Ms: 9 } });
    expect(hist).toHaveLength(1);
    expect(hist[0].err).toBe(20);
    expect(sparklinePoints([0, 50, 100], 100, 50, 100)).toContain('97.0,3.0');
    expect(niceCeiling(67)).toBe(100);
    expect(niceCeiling(10000)).toBe(10000);
    expect(formatChartNum(10000)).toBe('10k');
    expect(formatChartTime(1200)).toBe('1.2s');
    expect(formatChartTime(10000)).toBe('10s');
    expect(mixShares(70, 20, 10)).toEqual({ ok: 70, fail: 20, timeout: 10 });
    expect(loadProgressPct({ elapsedMs: 2500, spec: { durationMs: 10000 } })).toBe(25);
  });
});
