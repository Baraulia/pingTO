import { describe, expect, it } from 'vitest';
import { runPreRequest, runTests } from '../../modules/sandbox.js';

describe('sandbox', () => {
  it('lets pre-request scripts set variables', () => {
    const ctx = { variables: { a: '1' }, request: {} };
    runPreRequest(`pm.environment.set('token', 'abc'); pm.variables.set('a', '2');`, ctx);
    expect(ctx.variables.token).toBe('abc');
    expect(ctx.variables.a).toBe('2');
  });

  it('runs passing and failing tests against a response', () => {
    const results = runTests(
      `pm.test('code', () => pm.expect(pm.response.code).toBe(200));
       pm.test('ok', () => pm.expect(pm.response.json().ok).toBe(true));
       pm.test('fail', () => pm.expect(pm.response.code).toBe(500));`,
      { status: 200, body: '{"ok":true}' },
      { variables: {} }
    );
    expect(results.filter((r) => r.pass).map((r) => r.name)).toEqual(['code', 'ok']);
    expect(results.find((r) => r.name === 'fail').pass).toBe(false);
  });
});
