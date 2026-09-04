export function parseUrlParams(url) {
  try {
    const parsed = new URL(url);
    return [...parsed.searchParams.entries()].map(([key, value]) => ({
      key,
      value,
      enabled: true,
    }));
  } catch {
    const q = String(url || '').split('?')[1] || '';
    if (!q) return [];
    return q.split('&').filter(Boolean).map((part) => {
      const eq = part.indexOf('=');
      return {
        key: decodeURIComponent(eq === -1 ? part : part.slice(0, eq)),
        value: decodeURIComponent(eq === -1 ? '' : part.slice(eq + 1)),
        enabled: true,
      };
    });
  }
}

export function applyParamsToUrl(url, params, { encode = true } = {}) {
  const raw = String(url || '').trim();
  const [base] = raw.split('#');
  const path = (base || '').split('?')[0];
  const hash = raw.includes('#') ? `#${raw.split('#').slice(1).join('#')}` : '';
  const pairs = [];
  (params || []).forEach((p) => {
    if (p.enabled === false || !p.key) return;
    const key = encode ? encodeURIComponent(p.key) : p.key;
    const value = encode ? encodeURIComponent(p.value ?? '') : String(p.value ?? '');
    pairs.push(`${key}=${value}`);
  });
  return `${path}${pairs.length ? `?${pairs.join('&')}` : ''}${hash}`;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function applyPathParams(url, params, { encode = true } = {}) {
  const raw = String(url || '');
  const hashIdx = raw.indexOf('#');
  const hash = hashIdx >= 0 ? raw.slice(hashIdx) : '';
  const noHash = hashIdx >= 0 ? raw.slice(0, hashIdx) : raw;
  const qIdx = noHash.indexOf('?');
  const query = qIdx >= 0 ? noHash.slice(qIdx) : '';
  let path = qIdx >= 0 ? noHash.slice(0, qIdx) : noHash;
  (params || []).forEach((p) => {
    if (!p.key || p.enabled === false) return;
    const val = encode ? encodeURIComponent(p.value ?? '') : String(p.value ?? '');
    path = path.replace(new RegExp(`:${escapeRegExp(p.key)}(?=$|[/?#])`, 'g'), val);
    path = path.split(`{${p.key}}`).join(val);
  });
  return `${path}${query}${hash}`;
}
