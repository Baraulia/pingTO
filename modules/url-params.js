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

export function applyParamsToUrl(url, params) {
  const raw = String(url || '').trim();
  const [base] = raw.split('#');
  const path = (base || '').split('?')[0];
  const hash = raw.includes('#') ? `#${raw.split('#').slice(1).join('#')}` : '';
  const usp = new URLSearchParams();
  (params || []).forEach((p) => {
    if (p.enabled !== false && p.key) usp.append(p.key, p.value ?? '');
  });
  const query = usp.toString();
  return `${path}${query ? `?${query}` : ''}${hash}`;
}

export function applyPathParams(url, params) {
  let out = String(url || '');
  (params || []).forEach((p) => {
    if (!p.key) return;
    out = out.split(`:${p.key}`).join(encodeURIComponent(p.value ?? ''));
    out = out.split(`{${p.key}}`).join(encodeURIComponent(p.value ?? ''));
  });
  return out;
}
