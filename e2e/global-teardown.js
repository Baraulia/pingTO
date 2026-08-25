import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const statePath = path.join(root, 'e2e', '.testd-state.json');

export default async function globalTeardown() {
  if (!fs.existsSync(statePath)) return;
  let state;
  try {
    state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch {
    return;
  }
  fs.rmSync(statePath, { force: true });
  if (!state?.owned || !state.pid) return;
  try {
    if (process.platform === 'win32') {
      const { spawnSync } = await import('node:child_process');
      spawnSync('taskkill', ['/pid', String(state.pid), '/T', '/F'], { windowsHide: true });
    } else {
      process.kill(state.pid, 'SIGTERM');
    }
  } catch {
    /* already gone */
  }
}
