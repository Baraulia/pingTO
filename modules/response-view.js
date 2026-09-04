import { highlightJson } from './json-tools.js';

export const JSON_TREE_NODE_CAP = 2500;
export const JSON_TREE_CHAR_CAP = 120000;

export function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function jsonPathJoin(parts) {
  return (parts || []).reduce((acc, part) => {
    if (typeof part === 'number') return `${acc}[${part}]`;
    const key = String(part);
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return `${acc}.${key}`;
    return `${acc}[${JSON.stringify(key)}]`;
  }, '$');
}

export function mimeType(contentType) {
  return String(contentType || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
}

export function isImageContentType(contentType) {
  return mimeType(contentType).startsWith('image/');
}

export function isHtmlContentType(contentType) {
  return mimeType(contentType).includes('html');
}

export function isXmlContentType(contentType) {
  const mime = mimeType(contentType);
  return mime.includes('xml') && !mime.includes('html');
}

export function isJsonContentType(contentType) {
  const mime = mimeType(contentType);
  return mime.includes('json') || mime.endsWith('+json');
}

export function tryParseJson(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, value: undefined };
  }
}

export function jsonNodeCount(value, cap = JSON_TREE_NODE_CAP) {
  let n = 0;
  const walk = (node) => {
    if (n >= cap) return;
    n += 1;
    if (!node || typeof node !== 'object') return;
    const kids = Array.isArray(node) ? node : Object.values(node);
    for (const child of kids) walk(child);
  };
  walk(value);
  return n;
}

export function collectionSize(value) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === 'object') return Object.keys(value).length;
  return 0;
}

export function shouldExpandJsonNode(depth, count) {
  if (depth === 0) return true;
  if (depth === 1 && count <= 30) return true;
  return count <= 8;
}

export function highlightXml(text) {
  const escaped = escapeHtml(text);
  return escaped.replace(
    /(&lt;!--[\s\S]*?--&gt;)|(&lt;\/?)([\w:.-]+)((?:(?!\/?&gt;).)*)(\/?&gt;)/g,
    (all, comment, open, name, attrs, close) => {
      if (comment) return `<span class="x-cmt">${comment}</span>`;
      const attrHtml = String(attrs || '').replace(
        /([\w:.-]+)(=)(&quot;[\s\S]*?&quot;)/g,
        '<span class="x-attr">$1</span>$2<span class="x-str">$3</span>'
      );
      return `<span class="x-tag">${open}${name}</span>${attrHtml}<span class="x-tag">${close}</span>`;
    }
  );
}

export function renderLinedHtml(innerHtml) {
  const lines = String(innerHtml ?? '').split('\n');
  return lines
    .map((line, i) => {
      const content = line === '' ? ' ' : line;
      return `<div class="ln-row"><span class="ln-n">${i + 1}</span><span class="ln-c">${content}</span></div>`;
    })
    .join('');
}

function primitiveHtml(value) {
  if (value === null) return '<span class="j-null">null</span>';
  if (typeof value === 'boolean') return `<span class="j-bool">${value}</span>`;
  if (typeof value === 'number') return `<span class="j-num">${value}</span>`;
  if (typeof value === 'string') return `<span class="j-str">${escapeHtml(JSON.stringify(value))}</span>`;
  return `<span class="j-str">${escapeHtml(String(value))}</span>`;
}

function keyButton(path, label) {
  return `<button type="button" class="jt-key" data-json-path="${escapeHtml(path)}" title="${escapeHtml(path)}">${escapeHtml(label)}</button>`;
}

function renderNode(value, parts, depth, keyLabel) {
  const path = jsonPathJoin(parts);
  const prefix =
    keyLabel != null ? `${keyButton(path, keyLabel)}<span class="jt-colon">:</span> ` : '';
  const rootPathAttr =
    keyLabel == null ? ` data-json-path="${escapeHtml(path)}" title="${escapeHtml(path)}"` : '';

  if (value !== null && typeof value === 'object') {
    const isArr = Array.isArray(value);
    const entries = isArr ? value.map((item, i) => [i, item]) : Object.entries(value);
    const count = entries.length;
    const expanded = shouldExpandJsonNode(depth, count);
    const open = isArr ? '[' : '{';
    const closeBracket = isArr ? ']' : '}';
    const summary = `… ${count} ${count === 1 ? 'item' : 'items'}`;
    const kids = entries
      .map(([key, child]) =>
        renderNode(child, [...parts, key], depth + 1, typeof key === 'number' ? `[${key}]` : String(key))
      )
      .join('');
    return `<div class="jt-node${expanded ? '' : ' is-collapsed'}" data-expanded="${expanded ? 'true' : 'false'}"><div class="jt-line" style="--d:${depth}"><button type="button" class="jt-toggle" aria-expanded="${expanded ? 'true' : 'false'}">${expanded ? '▾' : '▸'}</button>${prefix}<span class="jt-bracket"${rootPathAttr}>${open}</span><span class="jt-summary${expanded ? ' hidden' : ''}">${escapeHtml(summary)}</span></div><div class="jt-children">${kids}</div><div class="jt-line jt-close" style="--d:${depth}"><span class="jt-bracket">${closeBracket}</span></div></div>`;
  }
  return `<div class="jt-line" style="--d:${depth}">${prefix}${primitiveHtml(value)}</div>`;
}

export function canRenderJsonTree(text, value) {
  if (String(text || '').length > JSON_TREE_CHAR_CAP) return false;
  return jsonNodeCount(value) < JSON_TREE_NODE_CAP;
}

export function renderJsonTree(value) {
  return `<div class="json-tree">${renderNode(value, [], 0, null)}</div>`;
}

export function renderPrettyHtml(body, contentType) {
  const text = String(body ?? '');
  if (!text) return '';
  if (isXmlContentType(contentType) || (isHtmlContentType(contentType) && !isJsonContentType(contentType))) {
    return `<div class="lined">${renderLinedHtml(highlightXml(text))}</div>`;
  }
  const parsed = tryParseJson(text);
  if (parsed.ok && canRenderJsonTree(text, parsed.value)) {
    return renderJsonTree(parsed.value);
  }
  if (parsed.ok) {
    return `<div class="lined">${renderLinedHtml(highlightJson(text))}</div>`;
  }
  if (/^\s*</.test(text)) {
    return `<div class="lined">${renderLinedHtml(highlightXml(text))}</div>`;
  }
  return `<div class="lined">${renderLinedHtml(escapeHtml(text))}</div>`;
}

export function renderRawHtml(body) {
  return `<div class="lined">${renderLinedHtml(escapeHtml(body))}</div>`;
}

export function imageDataUrl(contentType, base64) {
  if (!base64) return '';
  return `data:${mimeType(contentType) || 'image/png'};base64,${base64}`;
}
