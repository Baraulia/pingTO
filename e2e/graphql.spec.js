import { test, expect, enablePro, importTestdCollection, openRequest, sendAndExpectStatus, responseJson } from './fixtures.js';

test.describe('GraphQL against testd', () => {
  test.beforeEach(async ({ page }) => {
    await importTestdCollection(page);
    await enablePro(page);
  });

  test('ping, user, users, introspection', async ({ page }) => {
    await openRequest(page, 'testd-gql-ping');
    await sendAndExpectStatus(page, 200);
    expect((await responseJson(page)).data.ping).toBe('pong');

    await openRequest(page, 'testd-gql-user');
    await sendAndExpectStatus(page, 200);
    expect((await responseJson(page)).data.user.id).toBe('7');

    await openRequest(page, 'testd-gql-users');
    await sendAndExpectStatus(page, 200);
    expect((await responseJson(page)).data.users).toHaveLength(2);

    await openRequest(page, 'testd-gql-introspect');
    await sendAndExpectStatus(page, 200);
    expect((await responseJson(page)).data.__schema).toBeTruthy();
  });
});
