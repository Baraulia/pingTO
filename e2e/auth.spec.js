import { test, expect, enablePro, importTestdCollection, openRequest, sendAndExpectStatus, responseJson } from './fixtures.js';

test.describe('Auth against testd', () => {
  test.beforeEach(async ({ page }) => {
    await importTestdCollection(page);
  });

  test('bearer and basic', async ({ page }) => {
    await openRequest(page, 'testd-auth-bearer');
    await sendAndExpectStatus(page, 200);
    expect((await responseJson(page)).auth).toBe('bearer');

    await openRequest(page, 'testd-auth-basic');
    await sendAndExpectStatus(page, 200);
    expect((await responseJson(page)).auth).toBe('basic');
  });

  test('digest', async ({ page }) => {
    await enablePro(page);
    await openRequest(page, 'testd-auth-digest');
    await page.locator('#reqSubtabs button[data-pane="auth"]').click();
    await expect(page.locator('#authType')).toHaveValue('digest');
    await expect(page.locator('#basicUser')).toHaveValue('{{username}}');
    await expect(page.locator('#basicPass')).toHaveValue('{{password}}');
    await sendAndExpectStatus(page, 200);
    expect((await responseJson(page)).auth).toBe('digest');
  });

  test('api key header and query', async ({ page }) => {
    await openRequest(page, 'testd-auth-apikey-header');
    await sendAndExpectStatus(page, 200);
    expect((await responseJson(page)).auth).toBe('apikey');

    await openRequest(page, 'testd-auth-apikey-query');
    await sendAndExpectStatus(page, 200);
  });

  test('oauth client credentials login then resource', async ({ page }) => {
    await enablePro(page);
    await openRequest(page, 'testd-oauth-token');
    await sendAndExpectStatus(page, 200);
    const tok = await responseJson(page);
    expect(tok.access_token).toBeTruthy();

    await openRequest(page, 'testd-oauth-cc-login');
    await page.locator('#reqSubtabs button[data-pane="auth"]').click();
    await page.locator('#oauthLoginBtn').click();
    await expect(page.locator('[data-testid="toast"]')).toContainText(/Token ready/i);
    await sendAndExpectStatus(page, 200);
    expect((await responseJson(page)).auth).toBe('oauth2');
  });
});
