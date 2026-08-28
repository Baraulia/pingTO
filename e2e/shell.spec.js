import { test, expect, disablePro, enablePro } from './fixtures.js';

test.describe('Free vs Pro shell', () => {
  test('starts in Free and gates GraphQL', async ({ page }) => {
    await expect(page.locator('body')).toHaveClass(/is-free/);
    const gql = page.locator('#reqSubtabs button[data-pane="graphql"]');
    await expect(gql).toHaveAttribute('data-pro', 'graphql');
    await gql.click();
    await expect(page.locator('#proModal')).not.toHaveClass(/hidden/);
    await expect(page.locator('#proModalText')).toContainText(/GraphQL/i);
    await expect(page.locator('#proModalList')).toContainText(/Postman/i);
    await expect(page.locator('#proModalList')).toContainText(/Insomnia/i);
    await expect(page.locator('#proModalList')).toContainText(/Bruno/i);
    await expect(page.locator('#proModalList li.current')).toContainText(/GraphQL/i);
    await page.locator('#closeProModal').click();
    await expect(page.locator('#proModal')).toHaveClass(/hidden/);
  });

  test('Load tab is Pro-gated', async ({ page }) => {
    const load = page.locator('#reqSubtabs button[data-pane="loadtest"]');
    await expect(load).toHaveAttribute('data-pro', 'loadtest');
    await load.click();
    await expect(page.locator('#proModal')).not.toHaveClass(/hidden/);
    await expect(page.locator('#proModalList')).toContainText(/Load testing|Нагрузочн/i);
  });

  test('Enable Pro from modal unlocks GraphQL', async ({ page }) => {
    await page.locator('#reqSubtabs button[data-pane="graphql"]').click();
    await expect(page.locator('#proModal')).not.toHaveClass(/hidden/);
    await page.locator('#proEnableBtn').click();
    await expect(page.locator('body')).toHaveClass(/is-pro/);
    await expect(page.locator('#proModal')).toHaveClass(/hidden/);
  });

  test('toggle Pro on and off', async ({ page }) => {
    await enablePro(page);
    await disablePro(page);
    await page.locator('#reqSubtabs button[data-pane="graphql"]').click();
    await expect(page.locator('#proModal')).not.toHaveClass(/hidden/);
  });

  test('Free allows extra tabs', async ({ page }) => {
    await page.locator('#reqTabs button', { hasText: '+' }).click();
    await page.locator('#reqTabs button', { hasText: '+' }).click();
    await expect(page.locator('.tab-chip')).toHaveCount(3);
  });

  test('theme toggle flips data-theme', async ({ page }) => {
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.locator('#themeToggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('language button shows the target language', async ({ page }) => {
    const btn = page.locator('#languageToggle');
    await expect(btn).toHaveText('RU');
    await btn.click();
    await expect(page.locator('#sendBtn')).toContainText(/Отправ/i);
    await expect(btn).toHaveText('EN');
    await btn.click();
    await expect(btn).toHaveText('RU');
  });

  test('sidebar collapse and palette', async ({ page }) => {
    await page.locator('#sidebarToggle').click();
    await expect(page.locator('body')).toHaveClass(/sidebar-collapsed/);
    await page.locator('#sidebarToggle').click();
    await page.locator('#paletteBtn').click();
    await expect(page.locator('#palette')).not.toHaveClass(/hidden/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#palette')).toHaveClass(/hidden/);
  });

  test('empty URL shows a toast', async ({ page }) => {
    await page.locator('#urlInput').fill('');
    await page.locator('#sendBtn').click();
    await expect(page.locator('[data-testid="toast"]')).toBeVisible();
  });

  test('request name updates the tab chip', async ({ page }) => {
    await page.locator('#reqName').fill('Smoke ping');
    await page.locator('#reqName').blur();
    await expect(page.locator('#reqTabs')).toContainText('Smoke ping');
  });
});
