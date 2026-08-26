import { test, expect, enablePro, importTestdCollection, openRequest } from './fixtures.js';

test.describe('Realtime against testd', () => {
  test.beforeEach(async ({ page }) => {
    await importTestdCollection(page);
    await enablePro(page);
  });

  test('websocket echo', async ({ page }) => {
    await openRequest(page, 'testd-ws');
    await page.locator('#wsConnectBtn').click();
    await expect(page.locator('#wsStatus')).toHaveClass(/online/, { timeout: 10_000 });
    await page.locator('#wsMessageInput').fill('hello-ws');
    await page.locator('#wsSendBtn').click();
    await expect(page.locator('#wsMessages')).toContainText('hello-ws');
    await page.locator('#wsDisconnectBtn').click();
    await expect(page.locator('#wsStatus')).toHaveClass(/offline/);
  });

  test('sse stream receives events', async ({ page }) => {
    await openRequest(page, 'testd-sse');
    await page.locator('#wsConnectBtn').click();
    await expect(page.locator('#wsStatus')).toHaveClass(/online/, { timeout: 10_000 });
    await expect(page.locator('#wsMessages')).toContainText('"n": 1', { timeout: 10_000 });
    await expect(page.locator('#wsMessages')).toContainText('"n": 8', { timeout: 15_000 });
  });
});
