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
    durationMs,
    count,
    rps: num(input.rps, 0, 0, 1000000),
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
    `${t('loadReportClients')}: ${snap.desiredWorkers || 0}`,
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
    for (const k of keys) lines.push(`  ${formatStatusCodeLabel(k, t)}: ${codes[k]}`);
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

export function niceCeiling(value) {
  const v = Math.max(0, Number(value) || 0);
  if (v <= 0) return 1;
  const exp = Math.floor(Math.log10(v));
  const mag = 10 ** exp;
  const n = v / mag;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * mag;
}

export function formatChartNum(n) {
  const v = Number(n) || 0;
  const abs = Math.abs(v);
  if (abs >= 10000) return `${(v / 1000).toFixed(abs % 1000 === 0 ? 0 : 1)}k`;
  if (abs >= 1000 && abs % 100 === 0) return `${(v / 1000).toFixed(abs % 1000 === 0 ? 0 : 1)}k`;
  if (Number.isInteger(v) || Math.abs(v - Math.round(v)) < 1e-6) return String(Math.round(v));
  if (abs < 10) return v.toFixed(1);
  return v.toFixed(0);
}

export function formatChartTime(ms) {
  const t = Math.max(0, Number(ms) || 0);
  if (t < 1000) return `${Math.round(t)}ms`;
  const s = t / 1000;
  if (s < 60) return s < 10 && s % 1 !== 0 ? `${s.toFixed(1)}s` : `${Math.round(s)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return `${m}m${String(rem).padStart(2, '0')}s`;
}

const CHART_W = 400;
const CHART_H = 176;
const PAD_L = 44;
const PAD_R = 12;
const PAD_T = 22;
const PAD_B = 28;

function chartPalette(standalone) {
  if (standalone) {
    return { grid: '#30363d', axis: '#6e7681', text: '#8b949e', target: '#d29922' };
  }
  return {
    grid: 'var(--line)',
    axis: 'var(--muted)',
    text: 'var(--muted)',
    target: 'var(--put)',
  };
}

function plotX(i, n, innerW) {
  if (n <= 1) return innerW;
  return (i / (n - 1)) * innerW;
}

function plotY(v, peak, innerH) {
  return innerH - (Math.max(0, Number(v) || 0) / peak) * innerH;
}

/** SVG chart with grid, Y ticks, time on X, optional target line and legend. */
export function buildChartSvg(opts = {}) {
  const {
    series = [],
    times = [],
    yMax,
    yLabel = '',
    xLabel = '',
    target,
    standalone = false,
    width = CHART_W,
    height = CHART_H,
  } = opts;
  const pal = chartPalette(standalone);
  const innerW = width - PAD_L - PAD_R;
  const innerH = height - PAD_T - PAD_B;
  const rawMax = Math.max(
    0,
    Number(yMax) || 0,
    ...series.flatMap((s) => (Array.isArray(s.values) ? s.values : [])),
    Number(target?.value) || 0,
  );
  const peak = niceCeiling(rawMax);
  const yTicks = 4;
  const parts = [];
  parts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="none"/>`);
  for (let i = 0; i <= yTicks; i++) {
    const frac = i / yTicks;
    const y = PAD_T + innerH * (1 - frac);
    const val = peak * frac;
    parts.push(`<line class="grid" x1="${PAD_L}" y1="${y.toFixed(1)}" x2="${PAD_L + innerW}" y2="${y.toFixed(1)}" stroke="${pal.grid}" stroke-width="1"/>`);
    parts.push(`<text class="lbl" x="${PAD_L - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end" fill="${pal.text}" font-size="9" font-family="system-ui,sans-serif">${escapeHtml(formatChartNum(val))}</text>`);
  }
  const tlist = Array.isArray(times) && times.length ? times : [0];
  const xCount = Math.min(5, Math.max(2, tlist.length));
  for (let i = 0; i < xCount; i++) {
    const idx = xCount === 1 ? 0 : Math.round((i / (xCount - 1)) * (tlist.length - 1));
    const x = PAD_L + plotX(idx, tlist.length, innerW);
    parts.push(`<line class="grid" x1="${x.toFixed(1)}" y1="${PAD_T}" x2="${x.toFixed(1)}" y2="${PAD_T + innerH}" stroke="${pal.grid}" stroke-width="1" stroke-dasharray="2 3"/>`);
    parts.push(`<text class="lbl" x="${x.toFixed(1)}" y="${PAD_T + innerH + 14}" text-anchor="middle" fill="${pal.text}" font-size="9" font-family="system-ui,sans-serif">${escapeHtml(formatChartTime(tlist[idx]))}</text>`);
  }
  parts.push(`<line class="axis" x1="${PAD_L}" y1="${PAD_T}" x2="${PAD_L}" y2="${PAD_T + innerH}" stroke="${pal.axis}" stroke-width="1.2"/>`);
  parts.push(`<line class="axis" x1="${PAD_L}" y1="${PAD_T + innerH}" x2="${PAD_L + innerW}" y2="${PAD_T + innerH}" stroke="${pal.axis}" stroke-width="1.2"/>`);
  if (yLabel) {
    parts.push(`<text class="lbl" x="12" y="${PAD_T + innerH / 2}" fill="${pal.text}" font-size="9" font-family="system-ui,sans-serif" text-anchor="middle" transform="rotate(-90 12 ${PAD_T + innerH / 2})">${escapeHtml(yLabel)}</text>`);
  }
  if (xLabel) {
    parts.push(`<text class="lbl" x="${PAD_L + innerW / 2}" y="${height - 4}" text-anchor="middle" fill="${pal.text}" font-size="9" font-family="system-ui,sans-serif">${escapeHtml(xLabel)}</text>`);
  }
  const tgt = Number(target?.value);
  if (tgt > 0 && peak > 0) {
    const y = PAD_T + plotY(tgt, peak, innerH);
    parts.push(`<line class="target" x1="${PAD_L}" y1="${y.toFixed(1)}" x2="${PAD_L + innerW}" y2="${y.toFixed(1)}" stroke="${pal.target}" stroke-width="1.2" stroke-dasharray="5 3"/>`);
    parts.push(`<text class="lbl" x="${PAD_L + innerW - 2}" y="${(y - 4).toFixed(1)}" text-anchor="end" fill="${pal.target}" font-size="9" font-family="system-ui,sans-serif">${escapeHtml(target.label || formatChartNum(tgt))}</text>`);
  }
  for (const line of series) {
    const list = Array.isArray(line.values) && line.values.length ? line.values : [0];
    const pts = list.map((v, i) => {
      const x = PAD_L + plotX(i, list.length, innerW);
      const y = PAD_T + plotY(v, peak, innerH);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const color = line.color || pal.axis;
    const cls = line.className ? ` class="${escapeHtml(line.className)}"` : '';
    parts.push(`<polyline${cls} fill="none" stroke="${color}" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round" points="${pts}"/>`);
  }
  const legend = series.filter((s) => s.label);
  if (legend.length) {
    let lx = PAD_L + 6;
    const ly = PAD_T - 4;
    for (const item of legend) {
      parts.push(`<rect x="${lx}" y="${ly - 7}" width="8" height="8" rx="1" fill="${item.color || pal.axis}"/>`);
      parts.push(`<text class="lbl" x="${lx + 11}" y="${ly}" fill="${pal.text}" font-size="9" font-family="system-ui,sans-serif">${escapeHtml(item.label)}</text>`);
      lx += 12 + item.label.length * 5.2 + 10;
    }
  }
  const inner = parts.join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="${height}" class="load-chart" preserveAspectRatio="xMidYMid meet">${inner}</svg>`;
}

export function chartInnerMarkup(opts = {}) {
  const svg = buildChartSvg(opts);
  const start = svg.indexOf('>') + 1;
  const end = svg.lastIndexOf('</svg>');
  return svg.slice(start, end);
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

export function formatStatusCodeLabel(code, t = (key) => key) {
  const key = String(code);
  if (key === '0') return t('loadReportCodeNet');
  return key;
}

export function httpTone(code) {
  const n = Number(code);
  if (!Number.isFinite(n) || n <= 0) return 'err';
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

export function buildLoadReportHtml(snap, history, t = (key) => key) {
  const h = Array.isArray(history) ? history : [];
  const times = h.map((s) => s.t);
  const rps = h.map((s) => s.rps);
  const p50 = h.map((s) => s.p50);
  const p95 = h.map((s) => s.p95);
  const p99 = h.map((s) => s.p99);
  const err = h.map((s) => s.err);
  const cli = h.map((s) => s.clients);
  const target = Number(snap?.spec?.rps) || 0;
  const xLabel = t('loadChartAxisTime');
  const rpsChart = buildChartSvg({
    series: [{ values: rps, color: '#3b82f6', className: 's-rps' }],
    times,
    yMax: Math.max(...rps, target, 1),
    yLabel: t('loadChartAxisRps'),
    xLabel,
    target: target > 0 ? { value: target, label: `${t('loadChartTarget')} ${formatChartNum(target)}` } : null,
    standalone: true,
  });
  const latChart = buildChartSvg({
    series: [
      { values: p50, color: '#22c55e', className: 's-p50', label: 'p50' },
      { values: p95, color: '#d29922', className: 's-p95', label: 'p95' },
      { values: p99, color: '#ef4444', className: 's-p99', label: 'p99' },
    ],
    times,
    yMax: Math.max(0, ...p50, ...p95, ...p99),
    yLabel: t('loadChartAxisMs'),
    xLabel,
    standalone: true,
  });
  const errChart = buildChartSvg({
    series: [{ values: err, color: '#ef4444', className: 's-err' }],
    times,
    yMax: 100,
    yLabel: t('loadChartAxisErr'),
    xLabel,
    standalone: true,
  });
  const cliChart = buildChartSvg({
    series: [{ values: cli, color: '#a371f7', className: 's-cli' }],
    times,
    yMax: Math.max(1, ...cli),
    yLabel: t('loadChartAxisClients'),
    xLabel,
    standalone: true,
  });
  const text = formatLoadReport(snap, t);
  return `<!DOCTYPE html>
<html lang="en" translate="no" class="notranslate"><head><meta charset="utf-8"><meta name="google" content="notranslate"><title>PingTo load report</title>
<style>
body{font:13px/1.45 system-ui,sans-serif;background:#0d1117;color:#e6edf3;margin:24px;max-width:960px}
h1,h2{font-size:16px} pre{white-space:pre-wrap;background:#161b22;padding:12px;border-radius:8px}
figure{margin:0 0 16px;background:#161b22;padding:10px 10px 6px;border-radius:8px}
figcaption{color:#8b949e;font-size:12px;margin-bottom:4px;font-weight:600}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media (max-width:720px){.grid{grid-template-columns:1fr}}
.load-chart{display:block}
</style></head><body>
<h1>PingTo</h1>
<pre>${escapeHtml(text)}</pre>
<h2>${escapeHtml(t('loadReportCharts'))}</h2>
<div class="grid">
<figure><figcaption>${escapeHtml(t('loadChartRps'))}</figcaption>${rpsChart}</figure>
<figure><figcaption>${escapeHtml(t('loadChartLatency'))}</figcaption>${latChart}</figure>
<figure><figcaption>${escapeHtml(t('loadChartErrors'))}</figcaption>${errChart}</figure>
<figure><figcaption>${escapeHtml(t('loadChartClients'))}</figcaption>${cliChart}</figure>
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
    signal: AbortSignal.timeout(20000),
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
