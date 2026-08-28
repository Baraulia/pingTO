export const DEFAULT_LOADTEST_MANIFEST_URL =
  'https://github.com/Baraulia/pingTO/releases/latest/download/latest.json';

export const LOAD_AGENT_PLATFORMS = [
  'windows-amd64',
  'windows-arm64',
  'macos-amd64',
  'macos-arm64',
  'linux-amd64',
  'linux-arm64',
];

export function detectLoadAgentPlatform(input = {}) {
  const platform = String(input.platform || '').toLowerCase();
  const ua = String(input.ua || '').toLowerCase();
  const arch = String(input.architecture || '').toLowerCase();
  const bitness = String(input.bitness || '');
  let os = 'linux';
  if (platform.includes('win') || ua.includes('windows')) os = 'windows';
  else if (platform.includes('mac') || ua.includes('mac')) os = 'macos';
  else if (platform.includes('linux') || ua.includes('linux') || ua.includes('cros')) os = 'linux';
  let cpu = 'amd64';
  const arm = arch.includes('arm') || ua.includes('arm64') || ua.includes('aarch64');
  const x86 = arch.includes('x86') || arch.includes('amd64') || ua.includes('x86_64') || ua.includes('win64') || bitness === '64';
  if (arm) cpu = 'arm64';
  else if (x86 || os === 'windows') cpu = 'amd64';
  return `${os}-${cpu}`;
}

export async function detectLoadAgentPlatformAsync() {
  const base = {
    ua: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    platform: typeof navigator !== 'undefined' ? (navigator.userAgentData?.platform || navigator.platform || '') : '',
  };
  try {
    if (typeof navigator !== 'undefined' && navigator.userAgentData?.getHighEntropyValues) {
      const hi = await navigator.userAgentData.getHighEntropyValues(['architecture', 'bitness', 'platform']);
      return detectLoadAgentPlatform({
        ...base,
        platform: hi.platform || base.platform,
        architecture: hi.architecture || '',
        bitness: hi.bitness || '',
      });
    }
  } catch {
    /* UA-CH not granted */
  }
  return detectLoadAgentPlatform(base);
}

export function compareVersions(a, b) {
  const pa = String(a || '0').split(/[.+-]/).map((n) => parseInt(n, 10) || 0);
  const pb = String(b || '0').split(/[.+-]/).map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length, 3);
  for (let i = 0; i < len; i += 1) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d > 0) return 1;
    if (d < 0) return -1;
  }
  return 0;
}

export function normalizeLoadManifest(raw = {}) {
  const assets = {};
  const src = raw.assets && typeof raw.assets === 'object' ? raw.assets : {};
  const base = String(raw.releaseBase || raw.baseUrl || '').replace(/\/+$/, '');
  for (const id of LOAD_AGENT_PLATFORMS) {
    const item = src[id] && typeof src[id] === 'object' ? src[id] : {};
    const file = String(item.file || `pingto-loadtest-${id}${id.startsWith('windows') ? '.exe' : ''}`);
    const url = String(item.url || (base ? `${base}/${file}` : '')).trim();
    assets[id] = {
      file,
      url,
      sha256: String(item.sha256 || '').toLowerCase().replace(/[^0-9a-f]/g, ''),
      size: Number(item.size) || 0,
    };
  }
  return {
    version: String(raw.version || '').trim(),
    tag: String(raw.tag || '').trim(),
    signed: raw.signed === true,
    remoteManifest: String(raw.remoteManifest || '').trim(),
    releasePage: String(raw.releasePage || '').trim(),
    releaseBase: base,
    listen: String(raw.listen || 'http://127.0.0.1:8788'),
    assets,
  };
}

export function mergeLoadManifest(bundled, remote) {
  const a = normalizeLoadManifest(bundled);
  if (!remote) return a;
  const b = normalizeLoadManifest(remote);
  const assets = { ...a.assets };
  for (const id of LOAD_AGENT_PLATFORMS) {
    const next = b.assets[id];
    if (next.url || next.sha256) assets[id] = { ...assets[id], ...next };
  }
  return {
    ...a,
    ...b,
    assets,
    remoteManifest: b.remoteManifest || a.remoteManifest,
    signed: a.signed || b.signed,
  };
}

export function verifyCommand(platformId, file) {
  if (String(platformId).startsWith('windows')) {
    return `Get-FileHash .\\${file} -Algorithm SHA256`;
  }
  return `shasum -a 256 ${file}`;
}

export async function fetchLoadManifest(url) {
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return normalizeLoadManifest(await res.json());
}
