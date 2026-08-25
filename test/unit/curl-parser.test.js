import { describe, expect, it } from 'vitest';
import { CurlParser } from '../../modules/curl-parser.js';

describe('CurlParser', () => {
  it('parses method, url, headers and body', () => {
    const parsed = CurlParser.parse(
      `curl -X POST 'http://127.0.0.1:8787/json' -H 'Content-Type: application/json' -d '{"a":1}'`
    );
    expect(parsed.method).toBe('POST');
    expect(parsed.url).toBe('http://127.0.0.1:8787/json');
    expect(parsed.headers).toEqual([{ key: 'Content-Type', value: 'application/json' }]);
    expect(parsed.body).toBe('{"a":1}');
  });

  it('promotes GET with -d to POST', () => {
    const parsed = CurlParser.parse(`curl http://x/echo -d hello`);
    expect(parsed.method).toBe('POST');
    expect(parsed.body).toBe('hello');
  });

  it('stringifies and validates', () => {
    const cmd = CurlParser.stringify('GET', 'http://x/health', [{ key: 'Accept', value: 'application/json' }], '');
    expect(cmd).toContain("curl -X GET");
    expect(cmd).toContain('http://x/health');
    expect(CurlParser.validate(cmd)).toBe(true);
    expect(CurlParser.validate('not a curl')).toBe(false);
  });
});
