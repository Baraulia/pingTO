import { describe, expect, it } from 'vitest';
import {
  diffText,
  formatJson,
  hintForResponse,
  jsonError,
  minifyJson,
  prettyXml,
  queryJsonPath,
} from '../../modules/json-tools.js';

describe('json-tools', () => {
  it('formats, minifies and reports json errors', () => {
    expect(formatJson('{"a":1}')).toBe('{\n  "a": 1\n}');
    expect(minifyJson('{\n  "a": 1\n}')).toBe('{"a":1}');
    expect(jsonError('{')).toBeTruthy();
    expect(jsonError('{"a":1}')).toBeNull();
  });

  it('pretty-prints xml and queries jsonpath', () => {
    const xml = prettyXml('<root><item>a</item></root>');
    expect(xml).toContain('<root>');
    expect(queryJsonPath({ data: { items: [{ n: 2 }] } }, '$.data.items[0].n')).toBe(2);
  });

  it('diffs lines and hints on status codes', () => {
    const rows = diffText('a\nb', 'a\nc');
    expect(rows[1].changed).toBe(true);
    expect(hintForResponse({ status: 401 })).toMatch(/401/);
    expect(hintForResponse({ status: 404 })).toMatch(/404/);
    expect(hintForResponse({ statusText: 'Aborted', error: 'timeout' })).toMatch(/timed out/i);
  });
});
