import { describe, expect, it } from 'vitest';
import { applyParamsToUrl, applyPathParams, parseUrlParams } from '../../modules/url-params.js';

describe('url-params', () => {
  it('parses query from a full URL', () => {
    expect(parseUrlParams('https://x.test/p?a=1&b=hi')).toEqual([
      { key: 'a', value: '1', enabled: true },
      { key: 'b', value: 'hi', enabled: true },
    ]);
  });

  it('rebuilds query from rows and drops disabled pairs', () => {
    const url = applyParamsToUrl('https://x.test/p?old=1#h', [
      { key: 'a', value: '1', enabled: true },
      { key: 'skip', value: 'x', enabled: false },
    ]);
    expect(url).toBe('https://x.test/p?a=1#h');
  });

  it('substitutes :id and {id} path params', () => {
    expect(applyPathParams('https://x.test/users/:id', [{ key: 'id', value: '42' }])).toBe(
      'https://x.test/users/42'
    );
    expect(applyPathParams('https://x.test/users/{id}', [{ key: 'id', value: '7' }])).toBe(
      'https://x.test/users/7'
    );
  });
});
