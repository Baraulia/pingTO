import { runPreRequestSync, runTestsSync } from './modules/sandbox-runtime.js';

window.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.source !== 'pingto-host' || !event.source) return;
  const { id, kind, payload } = data;
  try {
    if (kind === 'pre') {
      const ctx = { variables: { ...(payload.variables || {}) }, request: payload.request || {} };
      const out = runPreRequestSync(payload.script, ctx);
      event.source.postMessage({ source: 'pingto-sandbox', id, variables: ctx.variables, logs: out.logs }, '*');
      return;
    }
    if (kind === 'tests') {
      const ctx = { variables: { ...(payload.variables || {}) } };
      const results = runTestsSync(payload.script, payload.response || {}, ctx);
      event.source.postMessage({ source: 'pingto-sandbox', id, results, variables: ctx.variables }, '*');
    }
  } catch (error) {
    event.source.postMessage({ source: 'pingto-sandbox', id, error: String(error?.message || error) }, '*');
  }
});

window.parent.postMessage({ source: 'pingto-sandbox', ready: true }, '*');
