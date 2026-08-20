function esc(value) {
  return String(value ?? '').replace(/\r/g, '');
}

export function requestToBru(req) {
  const headers = (req.headers || [])
    .filter((h) => h.key)
    .map((h) => `  ${h.key}: ${h.value}`)
    .join('\n');
  const bodyBlock =
    req.body && req.bodyType !== 'none'
      ? `\nbody:${req.bodyType === 'json' ? 'json' : 'text'} {\n${esc(req.body)}\n}\n`
      : '';
  return `meta {
  name: ${esc(req.name || req.url || 'request')}
  type: http
  seq: 1
}

http {
  method: ${req.method || 'GET'}
  url: ${esc(req.url || '')}
}

headers {
${headers || '  ~'}
}
${bodyBlock}`;
}

export function collectionToBruFiles(collection) {
  const files = [];
  const walk = (items, prefix) => {
    (items || []).forEach((item) => {
      if (item.type === 'folder') walk(item.items, `${prefix}${item.name}/`);
      else {
        files.push({
          path: `${prefix}${item.name || item.method || 'req'}.bru`,
          content: requestToBru(item),
        });
      }
    });
  };
  walk(collection.items, `${collection.name || 'collection'}/`);
  return files;
}

export function downloadBruZipLike(collection) {
  const files = collectionToBruFiles(collection);
  const bundled = files.map((f) => `===== ${f.path} =====\n${f.content}`).join('\n\n');
  const blob = new Blob([bundled], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${collection.name || 'collection'}.bru.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export function sanitizeExport(collection, { stripSecrets = true } = {}) {
  const clone = JSON.parse(JSON.stringify(collection));
  const walk = (items) => {
    (items || []).forEach((item) => {
      if (item.type === 'folder') walk(item.items);
      else if (stripSecrets) {
        (item.headers || []).forEach((h) => {
          if (/authorization|cookie|api-key|secret|token/i.test(h.key || '')) h.value = '';
        });
        if (item.auth) {
          item.auth.token = '';
          item.auth.password = '';
          item.auth.clientSecret = '';
        }
      }
    });
  };
  walk(clone.items);
  return clone;
}
