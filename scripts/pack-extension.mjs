import { existsSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'pingto-cws.zip');

const entries = [
  'manifest.json',
  'background.js',
  'app.html',
  'app.js',
  'app.css',
  'sandbox.html',
  'sandbox-frame.js',
  'modules',
  '_locales',
  'icons',
  'lib',
  'data',
];

// Live UI is app.html. popup.js / pages/* are unused and must not ship.
// ToDelete/, testd/, loadtest/, tests, and node_modules are not packed.

const missing = entries.filter((name) => !existsSync(join(root, name)));
if (missing.length) {
  console.error('Missing required paths:', missing.join(', '));
  process.exit(1);
}

const { BILLING_CONFIG } = await import(pathToFileURL(join(root, 'modules', 'billing-config.js')).href);
if (!/^https:\/\//i.test(String(BILLING_CONFIG.checkoutUrl || '').trim())) {
  console.warn('Warning: modules/billing-config.js checkoutUrl is empty. Store users cannot pay until you set it.');
}

rmSync(out, { force: true });
const r = spawnSync('tar', ['-a', '-c', '-f', out, ...entries], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (r.status !== 0) process.exit(r.status ?? 1);
console.log(`Wrote ${out}`);
