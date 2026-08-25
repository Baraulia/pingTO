import { test, expect, enablePro, importTestdCollection, openRequest, sendAndExpectStatus, testdUrl } from './fixtures.js';

test.describe('Collections and environments', () => {
  test('create collection, save request, reopen', async ({ page }) => {
    await enablePro(page);
    await page.locator('#newCollectionName').fill('Manual save');
    await page.locator('#newCollectionBtn').click();
    await expect(page.locator('[data-testid="tree-collection"]')).toContainText('Manual save');
    await page.locator('#methodSelect').selectOption('GET');
    await page.locator('#urlInput').fill(`${testdUrl}/health`);
    await page.locator('#reqName').fill('Saved health');
    await page.locator('#saveRequestBtn').click();
    await expect(page.locator('[data-testid="tree-request"]')).toContainText('Saved health');
    await page.locator('#urlInput').fill('https://example.invalid/reset');
    await page.locator('#reqTabs button', { hasText: '+' }).click();
    await page.locator('.tab-chip', { hasText: 'Saved health' }).locator('span', { hasText: '×' }).click();
    await page.locator('[data-testid="tree-request"]').filter({ hasText: 'Saved health' }).click();
    await expect(page.locator('#urlInput')).toHaveValue(`${testdUrl}/health`);
    await sendAndExpectStatus(page, 200);
  });

  test('environment substitutes base_url', async ({ page }) => {
    await importTestdCollection(page);
    await page.locator('#editEnvBtn').click();
    await page.locator('#newEnvName').fill('testd');
    await page.locator('#createEnvBtn').click();
    const card = page.locator('.env-card').filter({ hasText: 'testd' });
    const val = card.locator('.env-val').first();
    await val.fill(testdUrl);
    await val.dispatchEvent('change');
    await page.locator('#closeEnvBtn').click();
    await page.locator('#environmentSelect').selectOption({ label: 'testd' });
    await openRequest(page, 'testd-env-health');
    await sendAndExpectStatus(page, 200);
  });

  test('search filters the tree', async ({ page }) => {
    await importTestdCollection(page);
    await page.locator('#sidebarSearch').fill('Bearer');
    await expect(page.locator('[data-testid="tree-request"][data-request-id="testd-auth-bearer"]')).toBeVisible();
    await expect(page.locator('[data-testid="tree-request"][data-request-id="testd-health"]')).toHaveCount(0);
  });
});
