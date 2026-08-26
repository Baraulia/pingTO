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

  it('replaces :code after a host:port without touching the port', () => {
    expect(
      applyPathParams('http://127.0.0.1:8787/status/:code', [{ key: 'code', value: '200' }])
    ).toBe('http://127.0.0.1:8787/status/200');
  });
});
