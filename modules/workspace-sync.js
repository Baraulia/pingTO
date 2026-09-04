function bytesToB64(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  bytes.forEach((b) => {
    s += String.fromCharCode(b);
  });
  return btoa(s);
}

function b64ToBytes(str) {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(password, salt, iterations = 100000) {
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export function buildWorkspace(parts = {}) {
  return {
    format: 'pingto-workspace',
    version: 1,
    exportedAt: new Date().toISOString(),
    collections: parts.collections || [],
    environments: parts.environments || [],
    settings: parts.settings || {},
    activeEnvId: parts.activeEnvId ?? null,
    language: parts.language || 'en',
    theme: parts.theme || 'dark',
    tabs: parts.tabs || null,
  };
}

export function isWorkspacePayload(data) {
  return Boolean(data && (data.format === 'pingto-workspace' || data.format === 'pingto-workspace-enc'));
}

export async function wrapWorkspace(payload, passphrase) {
  const pass = String(passphrase || '').trim();
  if (!pass) return payload;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pass, salt);
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(JSON.stringify(payload))
  );
  return {
    format: 'pingto-workspace-enc',
    version: 1,
    kdf: 'PBKDF2-SHA256',
    iter: 100000,
    salt: bytesToB64(salt),
    iv: bytesToB64(iv),
    ciphertext: bytesToB64(ct),
  };
}

export async function unwrapWorkspace(data, passphrase) {
  if (!data || typeof data !== 'object') throw new Error('Not a PingTo workspace');
  if (data.format === 'pingto-workspace') return data;
  if (data.format !== 'pingto-workspace-enc') throw new Error('Not a PingTo workspace');
  const pass = String(passphrase || '').trim();
  if (!pass) throw new Error('Workspace passphrase required');
  try {
    const salt = b64ToBytes(data.salt);
    const iv = b64ToBytes(data.iv);
    const key = await deriveKey(pass, salt, Number(data.iter) || 100000);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, b64ToBytes(data.ciphertext));
    const parsed = JSON.parse(new TextDecoder().decode(pt));
    if (!parsed || parsed.format !== 'pingto-workspace') throw new Error('Not a PingTo workspace');
    return parsed;
  } catch (err) {
    if (err?.message === 'Workspace passphrase required' || err?.message === 'Not a PingTo workspace') throw err;
    throw new Error('Workspace decrypt failed');
  }
}
