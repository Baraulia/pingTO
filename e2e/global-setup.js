import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const statePath = path.join(root, 'e2e', '.testd-state.json');
const testdUrl = process.env.PINGTO_TESTD_URL || 'http://127.0.0.1:8787';
const testdPort = Number(new URL(testdUrl).port || 8787);

function waitHealth(url, timeoutMs) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(`${url}/health`, (res) => {
        res.resume();
        if (res.statusCode === 200) {
          resolve();
          return;
        }
        retry();
      });
      req.on('error', retry);
      req.setTimeout(1500, () => {
        req.destroy();
        retry();
      });
    };
    const retry = () => {
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`testd did not become healthy at ${url} within ${timeoutMs}ms`));
        return;
      }
      setTimeout(tick, 250);
    };
    tick();
  });
}

function freePort(port) {
  if (process.platform === 'win32') {
    const out = spawnSync('netstat', ['-ano'], { encoding: 'utf8', windowsHide: true });
    const pids = new Set();
    for (const line of String(out.stdout || '').split(/\r?\n/)) {
      if (!line.includes(`:${port}`) || !/LISTENING/i.test(line)) continue;
      const pid = line.trim().split(/\s+/).pop();
      if (pid && /^\d+$/.test(pid) && pid !== '0') pids.add(pid);
    }
    for (const pid of pids) {
      spawnSync('taskkill', ['/PID', pid, '/T', '/F'], { windowsHide: true });
    }
    return;
  }
  spawnSync('sh', ['-c', `lsof -ti tcp:${port} | xargs -r kill -9`], { windowsHide: true });
}

export default async function globalSetup() {
  process.env.PINGTO_TESTD_URL = testdUrl;
  freePort(testdPort);
  await new Promise((r) => setTimeout(r, 400));

  const child = spawn('go', ['run', '.'], {
    cwd: path.join(root, 'testd'),
    env: {
      ...process.env,
      PINGTO_ADDR: `:${testdPort}`,
      PINGTO_LATENCY_MS: '0',
    },
    stdio: 'pipe',
    windowsHide: true,
  });
  child.stderr?.on('data', () => {});
  child.stdout?.on('data', () => {});
  fs.writeFileSync(statePath, JSON.stringify({ owned: true, url: testdUrl, pid: child.pid }));

  try {
    await waitHealth(testdUrl, 30000);
  } catch (err) {
    try {
      if (process.platform === 'win32') {
        spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true });
      } else {
        child.kill();
      }
    } catch {
      /* ignore */
    }
    throw err;
  }
}
