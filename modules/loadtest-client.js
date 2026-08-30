export const DEFAULT_LOADTEST_AGENT = 'http://127.0.0.1:8788';

export function normalizeAgentUrl(raw) {
  const value = String(raw || DEFAULT_LOADTEST_AGENT).trim().replace(/\/+$/, '');
  try {
    const u = new URL(value);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return DEFAULT_LOADTEST_AGENT;
    return u.origin;
  } catch {
    return DEFAULT_LOADTEST_AGENT;
  }
}

function num(v, fallback, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function clampLoadSpec(input = {}) {
  const workers = num(input.workers, 10, 1, 200);
  let durationMs = num(input.durationMs, 0, 0, 600000);
  const count = Math.floor(num(input.count, 0, 0, 1000000));
  let profile = String(input.profile || '').toLowerCase();
  if (!['ramp', 'hold', 'constant'].includes(profile)) profile = 'constant';
  let rampMs = Math.floor(num(input.rampMs, 0, 0, 600000));
  let holdMs = Math.floor(num(input.holdMs, 0, 0, 600000));
  if (profile === 'ramp') {
    if (!rampMs) rampMs = 10000;
    holdMs = 0;
    durationMs = rampMs;
  } else if (profile === 'hold') {
    if (!rampMs) rampMs = 1000;
    if (!holdMs) holdMs = 10000;
    durationMs = Math.min(600000, rampMs + holdMs);
  } else if (!durationMs && !count) {
    durationMs = 10000;
  }
  return {
    method: String(input.method || 'GET').toUpperCase(),
    url: String(input.url || ''),
    headers: input.headers && typeof input.headers === 'object' ? input.headers : {},
    body: input.body == null ? '' : String(input.body),
    workers,
    durationMs,
    count,
    rps: num(input.rps, 0, 0, 10000),
    timeoutMs: num(input.timeoutMs, 10000, 50, 120000),
    followRedirects: input.followRedirects !== false,
    profile,
    rampMs,
    holdMs,
    abortErrorPct: num(input.abortErrorPct, 0, 0, 100),
    abortP95Ms: Math.floor(num(input.abortP95Ms, 0, 0, 120000)),
    abortConsecutive: Math.floor(num(input.abortConsecutive, 0, 0, 100000)),
    abortAfter: Math.floor(num(input.abortAfter, 0, 0, 1000000)),
    abortGraceMs: Math.floor(num(input.abortGraceMs, 0, 0, 600000)),
    ammo: Array.isArray(input.ammo) ? input.ammo.slice(0, 2000) : [],
    ammoMode: String(input.ammoMode || 'roundrobin').toLowerCase() === 'random' ? 'random' : 'roundrobin',
    compensate: input.compensate && typeof input.compensate === 'object' ? input.compensate : null,
  };
}

export function formatMs(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return '0';
  if (n < 1) return n.toFixed(3);
  if (n < 10) return n.toFixed(2);
  return n.toFixed(1);
}

export function formatLoadReport(snap, t = (key) => key) {
  if (!snap) return '';
  const lat = snap.latency || {};
  const codes = snap.statusCodes || {};
  const pct = ((Number(snap.errorRate) || 0) * 100).toFixed(1);
  const target = Number(snap.spec?.rps) || 0;
  const live = Number(snap.rpsLive);
  const avg = Number(snap.rps) || 0;
  const lines = [
    `${t('loadReportStatus')}: ${t(`loadStatus_${snap.status || 'running'}`)}`,
  ];
  if (snap.abort) {
    lines.push(`${t('loadReportAbort')}: ${t(`loadAbort_${snap.abort}`)}`);
  }
  lines.push(
    `${t('loadReportPhase')}: ${t(`loadPhase_${snap.phase || 'steady'}`)}`,
    `${t('loadReportElapsed')}: ${snap.elapsedMs || 0} ms`,
    `${t('loadReportClients')}: ${snap.desiredWorkers || 0} / ${snap.spec?.workers || 0}`,
    '',
    `${t('loadReportRequests')}: ${snap.total || 0}`,
    `${t('loadReportOk')}: ${snap.ok || 0}`,
    `${t('loadReportFail')}: ${snap.fail || 0}`,
    `${t('loadReportTimeout')}: ${snap.timeout || 0}`,
    `${t('loadReportErrorRate')}: ${pct}%`,
    `${t('loadReportRpsTarget')}: ${target > 0 ? target : t('loadReportRpsUncapped')}`,
    `${t('loadReportRpsLive')}: ${Number.isFinite(live) ? live.toFixed(0) : '—'}`,
    `${t('loadReportRpsAvg')}: ${avg.toFixed(1)}`,
    `${t('loadReportRpsMax')}: ${(Number(snap.rpsMax) || 0).toFixed(0)}`,
    `${t('loadReportBytes')}: ${snap.bytesIn || 0}`,
    `${t('loadReportCompensate')}: ${snap.compensateOk || 0} / ${snap.compensateFail || 0}`,
    '',
    `${t('loadReportLatency')}:`,
    `  ${t('loadReportLatMin')} ${formatMs(lat.minMs)}  ${t('loadReportLatAvg')} ${formatMs(lat.avgMs)}  p50 ${formatMs(lat.p50Ms)}`,
    `  p95 ${formatMs(lat.p95Ms)}  p99 ${formatMs(lat.p99Ms)}  ${t('loadReportLatMax')} ${formatMs(lat.maxMs)}`,
    t('loadReportLatencyHint'),
  );
  const keys = Object.keys(codes).sort((a, b) => Number(a) - Number(b));
  if (keys.length) {
    lines.push('', `${t('loadReportCodes')}:`);
    for (const k of keys) lines.push(`  ${k}: ${codes[k]}`);
  }
  return lines.join('\n');
}

const SAMPLE_CAP = 160;

export function pushLoadSample(history, snap, max = SAMPLE_CAP) {
  const lat = snap?.latency || {};
  const next = (Array.isArray(history) ? history : []).concat({
    t: Number(snap?.elapsedMs) || 0,
    rps: Number(snap?.rpsLive != null ? snap.rpsLive : snap?.rps) || 0,
    p50: Number(lat.p50Ms) || 0,
    p95: Number(lat.p95Ms) || 0,
    p99: Number(lat.p99Ms) || 0,
    err: (Number(snap?.errorRate) || 0) * 100,
    clients: Number(snap?.desiredWorkers) || 0,
  });
  return next.length > max ? next.slice(next.length - max) : next;
}

export function sparklinePoints(values, width = 240, height = 64, maxVal) {
  const list = Array.isArray(values) && values.length ? values : [0];
  const peak = maxVal == null ? Math.max(0, ...list) : maxVal;
  const span = peak > 0 ? peak : 1;
  const pad = 3;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  return list.map((v, i) => {
    const x = pad + (list.length === 1 ? innerW : (i / (list.length - 1)) * innerW);
    const y = pad + innerH - (Math.max(0, Number(v) || 0) / span) * innerH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

export function mixShares(ok, fail, timeout) {
  const o = Math.max(0, Number(ok) || 0);
  const f = Math.max(0, Number(fail) || 0);
  const n = Math.max(0, Number(timeout) || 0);
  const t = o + f + n;
  if (!t) return { ok: 0, fail: 0, timeout: 0 };
  return { ok: (100 * o) / t, fail: (100 * f) / t, timeout: (100 * n) / t };
}

export function loadProgressPct(snap) {
  const dur = Number(snap?.spec?.durationMs) || 0;
  if (dur <= 0) return snap?.status === 'running' ? 0 : 100;
  return Math.max(0, Math.min(100, (100 * (Number(snap?.elapsedMs) || 0)) / dur));
}

export function httpTone(code) {
  const n = Number(code);
  if (n >= 200 && n < 300) return 'ok';
  if (n >= 300 && n < 400) return 'redir';
  if (n >= 400 && n < 500) return 'warn';
  return 'err';
}

export function parseAmmoJson(text) {
  const raw = String(text || '').trim();
  if (!raw) return [];
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error('ammo must be a JSON array');
  return data.slice(0, 2000).map((item, i) => {
    if (typeof item === 'string') return { body: item };
    if (!item || typeof item !== 'object') throw new Error(`ammo[${i}]`);
    const round = {};
    if (item.method) round.method = String(item.method).toUpperCase();
    if (item.url) round.url = String(item.url);
    if (item.body != null) round.body = String(item.body);
    if (item.headers && typeof item.headers === 'object') round.headers = item.headers;
    if (item.compensate && typeof item.compensate === 'object') {
      round.compensate = {
        method: String(item.compensate.method || 'DELETE').toUpperCase(),
        url: String(item.compensate.url || ''),
        body: item.compensate.body == null ? '' : String(item.compensate.body),
      };
    }
    return round;
  });
}

export function parseCompensate(method, url) {
  const u = String(url || '').trim();
  if (!u) return null;
  const m = String(method || '').trim().toUpperCase();
  return { method: m || 'DELETE', url: u };
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sparkSvg(values, color, maxVal) {
  const pts = sparklinePoints(values, 240, 64, maxVal);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 64" width="100%" height="72"><polyline fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" points="${pts}"/></svg>`;
}

export function buildLoadReportHtml(snap, history, t = (key) => key) {
  const h = Array.isArray(history) ? history : [];
  const rps = h.map((s) => s.rps);
  const p50 = h.map((s) => s.p50);
  const p95 = h.map((s) => s.p95);
  const p99 = h.map((s) => s.p99);
  const err = h.map((s) => s.err);
  const cli = h.map((s) => s.clients);
  const latMax = Math.max(0, ...p50, ...p95, ...p99);
  const cliMax = Math.max(1, ...cli, Number(snap?.spec?.workers) || 1);
  const text = formatLoadReport(snap, t);
  return `<!DOCTYPE html>
<html lang="en" translate="no" class="notranslate"><head><meta charset="utf-8"><meta name="google" content="notranslate"><title>PingTo load report</title>
<style>
body{font:13px/1.45 system-ui,sans-serif;background:#0d1117;color:#e6edf3;margin:24px;max-width:900px}
h1,h2{font-size:16px} pre{white-space:pre-wrap;background:#161b22;padding:12px;border-radius:8px}
figure{margin:0 0 16px;background:#161b22;padding:10px;border-radius:8px}
figcaption{color:#8b949e;font-size:12px;margin-bottom:6px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
</style></head><body>
<h1>PingTo</h1>
<pre>${escapeHtml(text)}</pre>
<h2>${escapeHtml(t('loadReportCharts'))}</h2>
<div class="grid">
<figure><figcaption>${escapeHtml(t('loadChartRps'))}</figcaption>${sparkSvg(rps, '#3b82f6')}</figure>
<figure><figcaption>${escapeHtml(t('loadChartLatency'))}</figcaption>
${sparkSvg(p50, '#22c55e', latMax)}${sparkSvg(p95, '#d29922', latMax)}${sparkSvg(p99, '#ef4444', latMax)}
</figure>
<figure><figcaption>${escapeHtml(t('loadChartErrors'))}</figcaption>${sparkSvg(err, '#ef4444', 100)}</figure>
<figure><figcaption>${escapeHtml(t('loadChartClients'))}</figcaption>${sparkSvg(cli, '#a371f7', cliMax)}</figure>
</div>
</body></html>`;
}

export async function checkLoadAgent(base) {
  const url = normalizeAgentUrl(base);
  const res = await fetch(`${url}/health`, { method: 'GET' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (!json?.ok) throw new Error('agent not ready');
  return json;
}

export async function startLoadRun(base, spec) {
  const url = normalizeAgentUrl(base);
  const res = await fetch(`${url}/v1/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(clampLoadSpec(spec)),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

export async function stopLoadRun(base, id) {
  const url = normalizeAgentUrl(base);
  const res = await fetch(`${url}/v1/runs/${encodeURIComponent(id)}/stop`, { method: 'POST' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

export function subscribeLoadRun(base, id, onSnapshot, onError) {
  const url = `${normalizeAgentUrl(base)}/v1/runs/${encodeURIComponent(id)}/events`;
  const es = new EventSource(url);
  es.onmessage = (ev) => {
    try {
      onSnapshot(JSON.parse(ev.data));
    } catch (err) {
      onError?.(err);
    }
  };
  es.onerror = () => {
    onError?.(new Error('stream closed'));
    es.close();
  };
  return () => es.close();
}
