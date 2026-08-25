import { test, expect, importTestdCollection, openRequest, sendAndExpectStatus, testdUrl } from './fixtures.js';

test.describe('Request history', () => {
  test('opens as a modal with name and full URL', async ({ page }) => {
    await importTestdCollection(page);
    await openRequest(page, 'testd-health');
    await page.locator('#reqName').fill('Health check');
    await sendAndExpectStatus(page, 200);
    await page.locator('#historyBtn').click();
    await expect(page.locator('#historyModal')).not.toHaveClass(/hidden/);
    const row = page.locator('[data-testid="history-item"]').first();
    await expect(row).toContainText('Health check');
    await expect(row).toContainText(`${testdUrl}/health`);
    await expect(row.locator('.history-url')).toBeVisible();
  });
});
