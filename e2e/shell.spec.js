import { test, expect, disablePro, enablePro } from './fixtures.js';

test.describe('Free vs Pro shell', () => {
  test('starts in Free and gates collections import', async ({ page }) => {
    await expect(page.locator('body')).toHaveClass(/is-free/);
    await expect(page.getByRole('button', { name: /Import.*PRO/i })).toBeVisible();
    await page.locator('#importAnyBtn').click();
    await expect(page.locator('#proModal')).not.toHaveClass(/hidden/);
    await page.locator('#closeProModal').click();
    await expect(page.locator('#proModal')).toHaveClass(/hidden/);
  });

  test('Enable Pro from modal unlocks collections', async ({ page }) => {
    await page.locator('#newCollectionBtn').click();
    await expect(page.locator('#proModal')).not.toHaveClass(/hidden/);
    await page.locator('#proEnableBtn').click();
    await expect(page.locator('body')).toHaveClass(/is-pro/);
    await expect(page.locator('#proModal')).toHaveClass(/hidden/);
  });

  test('toggle Pro on and off', async ({ page }) => {
    await enablePro(page);
    await disablePro(page);
    await page.locator('#saveRequestBtn').click();
    await expect(page.locator('#proModal')).not.toHaveClass(/hidden/);
  });

  test('theme toggle flips data-theme', async ({ page }) => {
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('#themeToggle')).toHaveText('☀️');
    await page.locator('#themeToggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('#themeToggle')).toHaveText('🌙');
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
