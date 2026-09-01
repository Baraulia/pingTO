import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test as base, chromium, expect } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const testdUrl = process.env.PINGTO_TESTD_URL || 'http://127.0.0.1:8787';
const collectionPath = path.join(root, 'ToDelete', 'pingto-testd-collection.json');

export const test = base.extend({
  context: async ({}, use, testInfo) => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pingto-pw-'));
    const headless = testInfo.project.use.headless !== false && process.env.PINGTO_E2E_HEADED !== '1';
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless,
      channel: 'chromium',
      args: [
        `--disable-extensions-except=${root}`,
        `--load-extension=${root}`,
        '--disable-features=DisableLoadExtensionCommandLineSwitch',
      ],
      viewport: { width: 1280, height: 860 },
    });
    await use(context);
    await context.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  },
  extensionId: async ({ context }, use) => {
    let worker = context.serviceWorkers()[0];
    if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 20_000 });
    const extensionId = new URL(worker.url()).host;
    await use(extensionId);
  },
  page: async ({ context, extensionId }, use) => {
    const page = await context.newPage();
    await page.setViewportSize({ width: 1280, height: 860 });
    await page.goto(`chrome-extension://${extensionId}/app.html`);
    await page.locator('#sendBtn').waitFor({ state: 'visible' });
    await ensureDesktopLayout(page);
    await use(page);
  },
});

export { expect, testdUrl, collectionPath, root };

export async function ensureDesktopLayout(page) {
  await page.setViewportSize({ width: 1280, height: 860 });
  const collapsed = await page.locator('body').evaluate((el) => el.classList.contains('sidebar-collapsed'));
  if (collapsed) {
    await page.locator('#sidebarToggle').click();
  }
  await expect(page.locator('.sidebar')).toBeVisible();
}

async function setProToggle(page, enabled) {
  await ensureDesktopLayout(page);
  await page.evaluate(async (on) => {
    await chrome.storage.local.set({ isPro: on });
  }, enabled);
}

export async function enablePro(page) {
  await setProToggle(page, true);
  await expect(page.locator('body')).toHaveClass(/is-pro/);
}

export async function disablePro(page) {
  await setProToggle(page, false);
  await expect(page.locator('body')).toHaveClass(/is-free/);
}

export async function importTestdCollection(page) {
  await page.locator('#importFile').setInputFiles(collectionPath);
  await expect(page.locator('[data-testid="tree-collection"]')).toContainText('PingTo testd');
  await expect(page.locator('[data-testid="tree-request"][data-request-id="testd-health"]')).toBeVisible();
  await page.locator('[data-testid="toast"]').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
}

export async function openRequest(page, requestId) {
  await page.locator(`[data-testid="tree-request"][data-request-id="${requestId}"]`).click();
  await expect(page.locator('#urlInput')).not.toHaveValue('');
}

export async function sendAndExpectStatus(page, status, timeout = 20_000) {
  await page.locator('#sendBtn').click();
  await expect(page.locator('#responseStatus')).not.toHaveText('—', { timeout });
  await expect(page.locator('#responseStatus')).toContainText(String(status), { timeout: 5_000 });
}

export async function responseJson(page) {
  const text = await page.locator('#responseBody').innerText();
  return JSON.parse(text);
}
