import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'dist', 'loadtest');
mkdirSync(outDir, { recursive: true });

const GITHUB_REPO = 'Baraulia/pingTO';
const version = process.env.LOADTEST_VERSION || '1.0.0';
const tag = process.env.RELEASE_TAG || `v${version}`;
const releaseBase = String(
  process.env.RELEASE_BASE || `https://github.com/${GITHUB_REPO}/releases/download/${tag}`,
).replace(/\/+$/, '');

const targets = [
  { id: 'windows-amd64', goos: 'windows', goarch: 'amd64', file: 'pingto-loadtest-windows-amd64.exe' },
  { id: 'windows-arm64', goos: 'windows', goarch: 'arm64', file: 'pingto-loadtest-windows-arm64.exe' },
  { id: 'macos-amd64', goos: 'darwin', goarch: 'amd64', file: 'pingto-loadtest-macos-amd64' },
  { id: 'macos-arm64', goos: 'darwin', goarch: 'arm64', file: 'pingto-loadtest-macos-arm64' },
  { id: 'linux-amd64', goos: 'linux', goarch: 'amd64', file: 'pingto-loadtest-linux-amd64' },
  { id: 'linux-arm64', goos: 'linux', goarch: 'arm64', file: 'pingto-loadtest-linux-arm64' },
];

const assets = {};
for (const t of targets) {
  const out = join(outDir, t.file);
  const r = spawnSync('go', ['build', '-o', out, '.'], {
    cwd: join(root, 'loadtest'),
    env: { ...process.env, GOOS: t.goos, GOARCH: t.goarch, CGO_ENABLED: '0' },
    stdio: 'inherit',
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
  const buf = readFileSync(out);
  assets[t.id] = {
    file: t.file,
    sha256: createHash('sha256').update(buf).digest('hex'),
    size: buf.length,
    url: releaseBase ? `${releaseBase}/${t.file}` : '',
  };
  console.log('built', t.file, assets[t.id].sha256.slice(0, 12), `${assets[t.id].size}b`);
}

const catalog = {
  version,
  tag,
  signed: false,
  listen: 'http://127.0.0.1:8788',
  remoteManifest: `https://github.com/${GITHUB_REPO}/releases/latest/download/latest.json`,
  releasePage: `https://github.com/${GITHUB_REPO}/releases/tag/${tag}`,
  releaseBase,
  assets,
};
const json = `${JSON.stringify(catalog, null, 2)}\n`;
writeFileSync(join(outDir, 'latest.json'), json);
mkdirSync(join(root, 'data'), { recursive: true });
writeFileSync(join(root, 'data', 'loadtest-latest.json'), json);
console.log('wrote dist/loadtest/latest.json and data/loadtest-latest.json');
