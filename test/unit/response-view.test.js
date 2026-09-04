import { describe, expect, it } from 'vitest';
import { highlightJson } from '../../modules/json-tools.js';
import {
  canRenderJsonTree,
  highlightXml,
  imageDataUrl,
  jsonPathJoin,
  jsonNodeCount,
  renderJsonTree,
  renderLinedHtml,
  renderPrettyHtml,
  shouldExpandJsonNode,
  tryParseJson,
} from '../../modules/response-view.js';

describe('response-view', () => {
  it('builds json paths for keys and indexes', () => {
    expect(jsonPathJoin(['data', 'items', 0, 'id'])).toBe('$.data.items[0].id');
    expect(jsonPathJoin(['weird.key'])).toBe('$["weird.key"]');
  });

  it('renders a collapsible json tree with copyable paths', () => {
    const html = renderJsonTree({ data: { items: [{ id: 7 }] } });
    expect(html).toContain('data-json-path="$.data.items[0].id"');
    expect(html).not.toContain('">$</');
    expect(html).toContain('data-json-path="$"');
    expect(html).toContain('… 1 item');
    expect(html).toContain('j-num');
  });

  it('highlights xml tags and attributes', () => {
    const html = highlightXml('<root><item id="1">a</item></root>');
    expect(html).toContain('x-tag');
    expect(html).toContain('x-attr');
    expect(html).toContain('x-str');
  });

  it('adds line numbers and wraps pretty xml', () => {
    const lined = renderLinedHtml(highlightXml('<a/>'));
    expect(lined).toContain('ln-n');
    expect(renderPrettyHtml('<root/>', 'application/xml')).toContain('lined');
    expect(renderPrettyHtml('{"a":1}', 'application/json')).toContain('json-tree');
  });

  it('falls back when json is too large for a tree', () => {
    expect(canRenderJsonTree('x'.repeat(120001), {})).toBe(false);
    expect(jsonNodeCount({ a: 1, b: { c: 2 } })).toBe(4);
    expect(shouldExpandJsonNode(0, 100)).toBe(true);
    expect(shouldExpandJsonNode(3, 20)).toBe(false);
    expect(tryParseJson('{')).toEqual({ ok: false, value: undefined });
    expect(highlightJson('{"a":1}')).toContain('j-key');
  });

  it('builds image data urls', () => {
    expect(imageDataUrl('image/png', 'abc')).toBe('data:image/png;base64,abc');
    expect(imageDataUrl('image/jpeg; charset=binary', 'xy')).toBe('data:image/jpeg;base64,xy');
  });
});
