export function formatJson(text) {
  return JSON.stringify(JSON.parse(text), null, 2);
}

export function minifyJson(text) {
  return JSON.stringify(JSON.parse(text));
}

export function jsonError(text) {
  if (!String(text || '').trim()) return null;
  try {
    JSON.parse(text);
    return null;
  } catch (e) {
    return e.message;
  }
}

export function highlightJson(text) {
  const escaped = String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped.replace(
    /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = 'num';
      if (/^"/.test(match)) cls = /:$/.test(match) ? 'key' : 'str';
      else if (/true|false/.test(match)) cls = 'bool';
      else if (/null/.test(match)) cls = 'null';
      return `<span class="j-${cls}">${match}</span>`;
    }
  );
}

export function prettyXml(xml) {
  const padded = String(xml || '').replace(/>(\s*)</g, '>$1\n<');
  const lines = padded.split('\n').map((l) => l.trim()).filter(Boolean);
  let indent = 0;
  return lines
    .map((line) => {
      if (line.startsWith('</')) indent = Math.max(indent - 1, 0);
      const out = `${'  '.repeat(indent)}${line}`;
      if (
        line.startsWith('<') &&
        !line.startsWith('</') &&
        !line.startsWith('<?') &&
        !line.endsWith('/>') &&
        !line.includes('</')
      ) {
        indent += 1;
      }
      return out;
    })
    .join('\n');
}

export function queryJsonPath(data, path) {
  const src = typeof data === 'string' ? JSON.parse(data) : data;
  const expr = String(path || '').trim();
  if (!expr || expr === '$') return src;
  const tokens = [];
  expr.replace(/\$/g, '').replace(/\[(\d+)\]|\.([A-Za-z0-9_]+)|\[\'([^\']+)\'\]|\["([^"]+)"\]/g, (_, idx, dot, sq, dq) => {
    tokens.push(idx !== undefined ? Number(idx) : dot || sq || dq);
    return '';
  });
  let cur = src;
  for (const token of tokens) {
    if (cur == null) return undefined;
    cur = cur[token];
  }
  return cur;
}

export function diffText(a, b) {
  const left = String(a || '').split('\n');
  const right = String(b || '').split('\n');
  const max = Math.max(left.length, right.length);
  const rows = [];
  for (let i = 0; i < max; i++) {
    const l = left[i] ?? '';
    const r = right[i] ?? '';
    rows.push({
      line: i + 1,
      left: l,
      right: r,
      changed: l !== r,
    });
  }
  return rows;
}

export function hintForResponse(response) {
  if (!response) return '';
  if (response.statusText === 'Aborted' || /timeout|cancelled/i.test(response.error || '')) {
    return 'hintTimeout';
  }
  if (response.status === 401) return 'hint401';
  if (response.status === 403) return 'hint403';
  if (response.status === 404) return 'hint404';
  if (response.status === 429) return 'hint429';
  if (response.status >= 500) return 'hint5xx';
  if (response.error && /Failed to fetch|NetworkError|CORS/i.test(response.error)) {
    return 'hintNetwork';
  }
  return '';
}
