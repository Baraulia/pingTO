import { evalIsBlocked, runPreRequestSync, runTestsSync } from './sandbox-runtime.js';

const pending = new Map();
let frameReady = null;
let msgId = 0;

function requestSnap(req) {
  if (!req) return {};
  return {
    method: req.method,
    url: req.url,
    name: req.name,
    headers: Array.isArray(req.headers) ? req.headers.map((row) => ({ ...row })) : [],
    body: req.body,
  };
}

function inExtensionPage() {
  return typeof document !== 'undefined' && typeof chrome?.runtime?.getURL === 'function';
}

function ensureFrame() {
  if (!inExtensionPage()) {
    return Promise.reject(new Error('sandbox frame unavailable'));
  }
  if (frameReady) return frameReady;
  frameReady = new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.src = chrome.runtime.getURL('sandbox.html');
    iframe.hidden = true;
    iframe.title = 'PingTo scripts';
    const fail = () => reject(new Error('sandbox failed to load'));
    const timer = setTimeout(fail, 8000);
    iframe.addEventListener('error', fail, { once: true });
    const onReady = (event) => {
      if (event.source !== iframe.contentWindow) return;
      const data = event.data;
      if (!data || data.source !== 'pingto-sandbox' || !data.ready) return;
      clearTimeout(timer);
      window.removeEventListener('message', onReady);
      resolve(iframe);
    };
    window.addEventListener('message', onReady);
    document.documentElement.appendChild(iframe);
  });
  window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || data.source !== 'pingto-sandbox' || data.ready) return;
    const wait = pending.get(data.id);
    if (wait) wait(data);
  });
  return frameReady;
}

async function callFrame(kind, payload) {
  const iframe = await ensureFrame();
  const id = ++msgId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('script timed out'));
    }, 8000);
    pending.set(id, (msg) => {
      clearTimeout(timer);
      pending.delete(id);
      if (msg.error) reject(new Error(msg.error));
      else resolve(msg);
    });
    iframe.contentWindow.postMessage({ source: 'pingto-host', id, kind, payload }, '*');
  });
}

export async function runPreRequest(script, ctx) {
  if (!String(script || '').trim()) return { ctx, logs: [] };
  if (!inExtensionPage() && !evalIsBlocked()) return runPreRequestSync(script, ctx);
  const msg = await callFrame('pre', {
    script,
    variables: { ...(ctx.variables || {}) },
    request: requestSnap(ctx.request),
  });
  Object.keys(ctx.variables).forEach((key) => {
    delete ctx.variables[key];
  });
  Object.assign(ctx.variables, msg.variables || {});
  return { ctx, logs: msg.logs || [] };
}

export async function runTests(script, response, ctx) {
  if (!String(script || '').trim()) return [];
  if (!inExtensionPage() && !evalIsBlocked()) return runTestsSync(script, response, ctx);
  const msg = await callFrame('tests', {
    script,
    response: { status: response.status, body: response.body },
    variables: { ...(ctx.variables || {}) },
  });
  Object.assign(ctx.variables, msg.variables || {});
  return msg.results || [];
}
