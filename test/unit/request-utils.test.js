import { describe, expect, it } from 'vitest';
import {
  applyEnvToHeaders,
  applyEnvVars,
  isHttpUrl,
  isWebSocketUrl,
  parseMultipartFields,
  requestEditFingerprint,
  resolveTabForCurl,
  sanitizeHeadersForStorage,
  utf8ToBase64,
} from '../../modules/request-utils.js';

describe('request-utils', () => {
  it('detects http and ws URLs', () => {
    expect(isHttpUrl('http://127.0.0.1:8787/health')).toBe(true);
    expect(isHttpUrl('https://example.com')).toBe(true);
    expect(isHttpUrl('ws://127.0.0.1:8787/ws/echo')).toBe(false);
    expect(isWebSocketUrl('ws://127.0.0.1:8787/ws/echo')).toBe(true);
    expect(isWebSocketUrl('wss://example.com')).toBe(true);
    expect(isHttpUrl('{{base_url}}/x')).toBe(false);
  });

  it('replaces {{ vars }} and leaves unknown keys', () => {
    expect(applyEnvVars('{{base_url}}/users', { base_url: 'http://127.0.0.1:8787' })).toBe(
      'http://127.0.0.1:8787/users'
    );
    expect(applyEnvVars('{{ missing }}', {})).toBe('{{ missing }}');
  });

  it('applies env vars to header keys and values', () => {
    expect(applyEnvToHeaders({ '{{h}}': '{{v}}' }, { h: 'X-A', v: '1' })).toEqual({ 'X-A': '1' });
  });

  it('resolves placeholders for copy as curl', () => {
    const parts = resolveTabForCurl(
      {
        method: 'POST',
        url: '{{base_url}}/echo',
        params: [{ key: 'tag', value: '{{tag}}', enabled: true }],
        pathParams: [],
        headers: [{ key: 'X-Name', value: '{{name}}', enabled: true }],
        bodyType: 'json',
        body: '{"email":"{{email}}"}',
        auth: {},
      },
      {
        base_url: 'http://127.0.0.1:8787',
        tag: 'alpha',
        name: 'Ada',
        email: 'ada@pingto.local',
        bearer_token: 'pingto-token',
      },
      { type: 'bearer', token: '{{bearer_token}}' }
    );
    expect(parts.url).toBe('http://127.0.0.1:8787/echo?tag=alpha');
    expect(parts.body).toBe('{"email":"ada@pingto.local"}');
    expect(parts.headers).toEqual(
      expect.arrayContaining([
        { key: 'X-Name', value: 'Ada' },
        { key: 'Authorization', value: 'Bearer pingto-token' },
      ])
    );
    expect(parts.url).not.toContain('{{');
    expect(parts.body).not.toContain('{{');
  });

  it('keeps placeholders when no environment is selected', () => {
    const parts = resolveTabForCurl(
      {
        method: 'POST',
        url: '{{base_url}}/echo',
        params: [{ key: 'tag', value: '{{tag}}', enabled: true }],
        pathParams: [],
        headers: [{ key: 'X-Name', value: '{{name}}', enabled: true }],
        bodyType: 'json',
        body: '{"email":"{{email}}"}',
      },
      null,
      { type: 'bearer', token: '{{bearer_token}}' }
    );
    expect(parts.url).toBe('{{base_url}}/echo?tag={{tag}}');
    expect(parts.body).toBe('{"email":"{{email}}"}');
    expect(parts.headers).toEqual(
      expect.arrayContaining([
        { key: 'X-Name', value: '{{name}}' },
        { key: 'Authorization', value: 'Bearer {{bearer_token}}' },
      ])
    );
  });

  it('encodes basic auth as base64', () => {
    expect(utf8ToBase64('pingto:pingto')).toBe(Buffer.from('pingto:pingto', 'utf8').toString('base64'));
  });

  it('parses multipart field lines and JSON objects', () => {
    expect(parseMultipartFields('a=1\nb=two')).toEqual([
      { name: 'a', value: '1' },
      { name: 'b', value: 'two' },
    ]);
    expect(parseMultipartFields('{"a":1}')).toEqual([{ name: 'a', value: '1' }]);
  });

  it('masks sensitive headers', () => {
    expect(sanitizeHeadersForStorage([{ key: 'Authorization', value: 'secret' }])).toEqual([
      { key: 'Authorization', value: '***' },
    ]);
    expect(sanitizeHeadersForStorage({ 'X-API-Key': 'k' })['X-API-Key']).toBe('***');
  });

  it('fingerprints saved request fields and ignores response noise', () => {
    const a = requestEditFingerprint({ name: 'Health', method: 'GET', url: '/health', response: { status: 200 } });
    const b = requestEditFingerprint({ name: 'Health', method: 'GET', url: '/health', testResults: [] });
    const c = requestEditFingerprint({ name: 'Health', method: 'POST', url: '/health' });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
