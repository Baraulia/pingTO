import { test, expect, enablePro, importTestdCollection, openRequest, sendAndExpectStatus, responseJson, testdUrl } from './fixtures.js';

test.describe('HTTP against testd', () => {
  test.beforeEach(async ({ page }) => {
    await importTestdCollection(page);
  });

  test('catalog and health', async ({ page }) => {
    await openRequest(page, 'testd-catalog');
    await sendAndExpectStatus(page, 200);
    const catalog = await responseJson(page);
    expect(catalog.name).toBe('PingTo testd');

    await openRequest(page, 'testd-health');
    await sendAndExpectStatus(page, 200);
    expect((await responseJson(page)).ok).toBe(true);
  });

  test('echo, path, query, headers', async ({ page }) => {
    await openRequest(page, 'testd-echo-post');
    await sendAndExpectStatus(page, 200);
    expect((await responseJson(page)).body).toContain('hello testd');

    await openRequest(page, 'testd-users');
    await sendAndExpectStatus(page, 200);
    expect((await responseJson(page)).id).toBe('42');

    await openRequest(page, 'testd-query');
    await sendAndExpectStatus(page, 200);
    expect((await responseJson(page)).query.a).toEqual(['1']);

    await openRequest(page, 'testd-headers');
    await sendAndExpectStatus(page, 200);
    const headers = (await responseJson(page)).headers;
    expect(JSON.stringify(headers)).toMatch(/X-PingTo-Test/i);
  });

  test('json form text html xml status head options', async ({ page }) => {
    await openRequest(page, 'testd-json-post');
    await sendAndExpectStatus(page, 200);
    expect((await responseJson(page)).json.name).toBe('ada');

    await openRequest(page, 'testd-form');
    await sendAndExpectStatus(page, 200);
    expect((await responseJson(page)).form.a).toEqual(['1']);

    await openRequest(page, 'testd-text');
    await sendAndExpectStatus(page, 200);
    await expect(page.locator('#responsePretty')).toContainText('pingto text body');

    await openRequest(page, 'testd-html');
    await sendAndExpectStatus(page, 200);
    await page.locator('#respViewModes button[data-rview="preview"]').click();
    await expect(page.locator('#responsePreview')).toBeVisible();

    await openRequest(page, 'testd-xml');
    await sendAndExpectStatus(page, 200);
    await page.locator('#respViewModes button[data-rview="pretty"]').click();
    await expect(page.locator('#responsePretty')).toContainText('<root>');

    await openRequest(page, 'testd-status-404');
    await sendAndExpectStatus(page, 404);

    await openRequest(page, 'testd-status-500');
    await sendAndExpectStatus(page, 500);

    await openRequest(page, 'testd-head');
    await sendAndExpectStatus(page, 200);

    await openRequest(page, 'testd-options');
    await sendAndExpectStatus(page, 204);
  });

  test('multipart and binary files', async ({ page }) => {
    await openRequest(page, 'testd-multipart');
    await page.locator('#reqSubtabs button[data-pane="body"]').click();
    await page.locator('#multiFiles').setInputFiles({
      name: 'note.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('file-bytes'),
    });
    await sendAndExpectStatus(page, 200);
    const multi = await responseJson(page);
    expect(multi.fields.title).toEqual(['demo']);
    expect(JSON.stringify(multi.files)).toMatch(/note\.txt/);

    await openRequest(page, 'testd-binary');
    await enablePro(page);
    await page.locator('#reqSubtabs button[data-pane="body"]').click();
    await page.locator('#binaryFile').setInputFiles({
      name: 'blob.bin',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('xyz'),
    });
    await expect(page.locator('[data-testid="toast"]')).toContainText(/blob\.bin/i);
    await sendAndExpectStatus(page, 200);
    expect((await responseJson(page)).bytes).toBe(3);
  });

  test('redirects follow hops', async ({ page }) => {
    await openRequest(page, 'testd-redirect-follow');
    await sendAndExpectStatus(page, 200);
    expect((await responseJson(page)).done).toBe(true);
    await page.locator('#respSubtabs button[data-rpane="redirects"]').click();
    await expect(page.locator('#responseRedirects')).toContainText('/redirect/');
  });

  test('redirects can stop on 3xx', async ({ page }) => {
    await openRequest(page, 'testd-redirect-stop');
    await page.locator('#sendBtn').click();
    await expect(page.locator('#responseStatus')).toHaveText(/302|0 /, { timeout: 20_000 });

    await openRequest(page, 'testd-redirect-keep');
    await sendAndExpectStatus(page, 200);
    expect((await responseJson(page)).body).toContain('keep-me');
  });

  test('cookies set and list', async ({ page }) => {
    await openRequest(page, 'testd-cookies-set-query');
    await sendAndExpectStatus(page, 200);
    await openRequest(page, 'testd-cookies-get');
    await sendAndExpectStatus(page, 200);
    await expect(page.locator('#responsePretty')).toContainText('sid');
  });

  test('slow-json returns body and does not block Send', async ({ page }) => {
    await openRequest(page, 'testd-slow-json');
    await sendAndExpectStatus(page, 200);
    expect((await responseJson(page)).message).toBe('slow-json');
  });

  test('cancel a delayed request', async ({ page }) => {
    await page.locator('#methodSelect').selectOption('GET');
    await page.locator('#urlInput').fill(`${testdUrl}/delay/4000`);
    await page.locator('#sendBtn').click();
    await expect(page.locator('#cancelBtn')).toBeVisible();
    await page.locator('#cancelBtn').click();
    await expect(page.locator('#sendBtn')).toBeVisible();
    await expect(page.locator('#responseStatus')).toContainText(/Abort|0 /i);
  });

  test('bytes payload size', async ({ page }) => {
    await openRequest(page, 'testd-bytes-small');
    await sendAndExpectStatus(page, 200);
    await expect(page.locator('#responseBody')).toHaveJSProperty('textContent', 'A'.repeat(100));
  });

  test('pretty json tree, wrap lines, and png preview', async ({ page }) => {
    await openRequest(page, 'testd-health');
    await sendAndExpectStatus(page, 200);
    await page.locator('#respViewModes button[data-rview="pretty"]').click();
    await expect(page.locator('#responsePretty .json-tree')).toBeVisible();
    await page.locator('#responsePretty [data-json-path="$.ok"]').hover();
    await expect(page.locator('#respPathHint')).toHaveText('$.ok');
    await page.locator('#respViewModes button[data-rview="raw"]').click();
    await expect(page.locator('#responseRawWrap .ln-n').first()).toHaveText('1');

    await page.locator('#methodSelect').selectOption('GET');
    await page.locator('#urlInput').fill(`${testdUrl}/png`);
    await sendAndExpectStatus(page, 200);
    await page.locator('#respViewModes button[data-rview="preview"]').click();
    await expect(page.locator('#responsePreviewImg')).toBeVisible();
    await expect(page.locator('#responsePreviewImg')).toHaveAttribute('src', /^data:image\/png;base64,/);
  });

  test('curl import round-trip', async ({ page }) => {
    await page.locator('#reqSubtabs button[data-pane="curl"]').click();
    await page.locator('#curlInput').fill(`curl -X GET ${testdUrl}/health`);
    await page.locator('#parseCurlBtn').click();
    await expect(page.locator('#urlInput')).toHaveValue(`${testdUrl}/health`);
    await sendAndExpectStatus(page, 200);
  });
});
