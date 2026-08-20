const HTTP_PROTOCOLS = new Set(['http:', 'https:']);
const WS_PROTOCOLS = new Set(['ws:', 'wss:']);
const SENSITIVE_HEADERS = /^(authorization|cookie|set-cookie|proxy-authorization|x-api-key|api-key)$/i;

export function isHttpUrl(url) {
  try {
    const parsed = new URL(url);
    return HTTP_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}

export function isWebSocketUrl(url) {
  try {
    const parsed = new URL(url);
    return WS_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}

export function applyEnvVars(value, variables = {}) {
  if (value == null || typeof value !== 'string') return value;
  return value.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match, rawKey) => {
    const key = rawKey.trim();
    if (Object.prototype.hasOwnProperty.call(variables, key)) {
      return String(variables[key] ?? '');
    }
    return match;
  });
}

export function applyEnvToHeaders(headers, variables = {}) {
  const result = {};
  Object.entries(headers || {}).forEach(([key, value]) => {
    result[applyEnvVars(key, variables)] = applyEnvVars(String(value ?? ''), variables);
  });
  return result;
}

export function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

export function parseMultipartFields(rawBody) {
  const trimmed = (rawBody || '').trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return Object.entries(parsed).map(([name, value]) => ({
          name,
          value: value == null ? '' : String(value),
        }));
      }
    } catch {
      // fall through to line parser
    }
  }

  return trimmed
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const eq = line.indexOf('=');
      if (eq === -1) return { name: line, value: '' };
      return { name: line.slice(0, eq).trim(), value: line.slice(eq + 1) };
    })
    .filter((field) => field.name);
}

export function sanitizeHeadersForStorage(headers) {
  if (Array.isArray(headers)) {
    return headers.map((h) => ({
      key: h.key,
      value: SENSITIVE_HEADERS.test(h.key) ? '***' : h.value,
    }));
  }
  const out = {};
  Object.entries(headers || {}).forEach(([key, value]) => {
    out[key] = SENSITIVE_HEADERS.test(key) ? '***' : value;
  });
  return out;
}

export function isCollectionShape(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  if (typeof data.name !== 'string' || !data.name.trim()) return false;
  if (data.requests != null && !Array.isArray(data.requests)) return false;
  return true;
}

export function normalizeImportedCollections(data) {
  const list = Array.isArray(data) ? data : [data];
  const valid = list.filter(isCollectionShape).map((coll) => ({
    id: coll.id || Date.now() + Math.floor(Math.random() * 1000),
    name: String(coll.name).trim(),
    requests: (coll.requests || []).filter((r) => r && typeof r === 'object').map((r) => ({
      id: r.id || Date.now() + Math.floor(Math.random() * 1000),
      method: r.method || 'GET',
      url: r.url || '',
      headers: Array.isArray(r.headers) ? r.headers : [],
      body: r.body ?? '',
      bodyType: r.bodyType || 'json',
      authType: r.authType || 'none',
    })),
    created: coll.created || new Date().toISOString(),
  }));
  return valid;
}

export function idsEqual(a, b) {
  return String(a) === String(b);
}

export function downloadText(filename, text, mime = 'application/json') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function debounce(fn, wait = 150) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}
