import { test, expect, importTestdCollection, openRequest, sendAndExpectStatus, testdUrl } from './fixtures.js';

test.describe('Collections and environments', () => {
  test('create collection, save request, reopen', async ({ page }) => {
    page.once('dialog', (dialog) => dialog.accept('Manual save'));
    await page.locator('#newCollectionBtn').click();
    await expect(page.locator('[data-testid="tree-collection"]')).toContainText('Manual save');
    await page.locator('#methodSelect').selectOption('GET');
    await page.locator('#urlInput').fill(`${testdUrl}/health`);
    await page.locator('#reqName').fill('Saved health');
    await page.locator('#saveRequestBtn').click();
    await expect(page.locator('[data-testid="tree-request"]')).toContainText('Saved health');
    await page.locator('#urlInput').fill('https://example.invalid/reset');
    await expect(page.locator('.tab-chip.active')).toHaveClass(/dirty/);
    await page.locator('#addTabBtn').click();
    await page.locator('.tab-chip', { hasText: 'Saved health' }).locator('.tab-close').click();
    await expect(page.locator('#unsavedModal')).not.toHaveClass(/hidden/);
    await page.locator('#unsavedDiscardBtn').click();
    await page.locator('[data-testid="tree-request"]').filter({ hasText: 'Saved health' }).click();
    await expect(page.locator('#urlInput')).toHaveValue(`${testdUrl}/health`);
    await expect(page.locator('[data-testid="tree-request"]').filter({ hasText: 'Saved health' })).toHaveClass(/selected/);
    await expect(page.locator('[data-testid="tree-collection"]')).toHaveClass(/selected/);
    await sendAndExpectStatus(page, 200);
  });

  test('environment substitutes base_url', async ({ page }) => {
    await importTestdCollection(page);
    await page.locator('#environmentSelect').selectOption('__env_new__');
    await page.locator('#newEnvName').fill('testd');
    await page.locator('#createEnvBtn').click();
    const card = page.locator('.env-card').filter({ hasText: 'testd' });
    const val = card.locator('.env-val').first();
    await val.fill(testdUrl);
    await val.dispatchEvent('change');
    await page.locator('#closeEnvBtn').click();
    await page.locator('#environmentSelect').selectOption({ label: 'testd' });
    await openRequest(page, 'testd-env-health');
    await expect(page.locator('[data-testid="tree-request"][data-request-id="testd-env-health"]')).toHaveClass(/selected/);
    await expect(page.locator('[data-testid="tree-folder"]').filter({ hasText: 'Env' })).toHaveClass(/selected/);
    await expect(page.locator('[data-testid="tree-collection"]')).toHaveClass(/selected/);
    await sendAndExpectStatus(page, 200);
  });

  test('discarding a new request does not add it to the collection', async ({ page }) => {
    page.once('dialog', (dialog) => dialog.accept('Keep clean'));
    await page.locator('#newCollectionBtn').click();
    await expect(page.locator('[data-testid="tree-collection"]')).toContainText('Keep clean');
    await page.locator('#addTabBtn').click();
    await page.locator('#urlInput').fill(`${testdUrl}/should-not-save`);
    await page.locator('#reqName').fill('Ghost request');
    await expect(page.locator('.tab-chip.active')).toHaveClass(/dirty/);
    await page.locator('#addTabBtn').click();
    await page.locator('.tab-chip', { hasText: 'Ghost request' }).locator('.tab-close').click();
    await page.locator('#unsavedDiscardBtn').click();
    await expect(page.locator('#unsavedModal')).toHaveClass(/hidden/);
    await expect(page.locator('[data-testid="tree-request"]')).toHaveCount(0);
    await expect(page.locator('.tab-chip', { hasText: 'Ghost request' })).toHaveCount(0);
  });

  test('unsaved edits can be saved from the close dialog', async ({ page }) => {
    page.once('dialog', (dialog) => dialog.accept('Dirty save'));
    await page.locator('#newCollectionBtn').click();
    await page.locator('#addTabBtn').click();
    await page.locator('#urlInput').fill(`${testdUrl}/health`);
    await page.locator('#reqName').fill('Keep me');
    await expect(page.locator('.tab-chip.active')).toHaveClass(/dirty/);
    await expect(page.locator('#saveRequestBtn')).toHaveClass(/needs-save/);
    await page.locator('#addTabBtn').click();
    await page.locator('.tab-chip', { hasText: 'Keep me' }).locator('.tab-close').click();
    await page.locator('#unsavedSaveBtn').click();
    await expect(page.locator('[data-testid="tree-request"]')).toContainText('Keep me');
    await expect(page.locator('.tab-chip', { hasText: 'Keep me' })).toHaveCount(0);
  });

  test('search filters the tree', async ({ page }) => {
    await importTestdCollection(page);
    await page.locator('#sidebarSearch').fill('Bearer');
    await expect(page.locator('[data-testid="tree-request"][data-request-id="testd-auth-bearer"]')).toBeVisible();
    await expect(page.locator('[data-testid="tree-request"][data-request-id="testd-health"]')).toHaveCount(0);
  });
});
