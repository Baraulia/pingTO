function headerList(headers) {
  if (!headers) return [];
  if (Array.isArray(headers)) {
    return headers
      .map((h) => ({ key: h?.key || h?.name, value: h?.value || '' }))
      .filter((h) => h.key);
  }
  return Object.entries(headers).map(([key, value]) => ({ key, value }));
}

function fromPostmanUrl(url) {
  if (!url) return '';
  if (typeof url === 'string') return url;
  if (url.raw) return url.raw;
  const host = (url.host || []).join('.');
  const path = (url.path || []).join('/');
  const proto = url.protocol || 'https';
  return `${proto}://${host}/${path}`;
}

function fromPostmanBody(body) {
  if (!body) return { bodyType: 'none', body: '' };
  if (body.mode === 'raw') {
    const lang = body.options?.raw?.language;
    return { bodyType: lang === 'json' ? 'json' : 'text', body: body.raw || '' };
  }
  if (body.mode === 'urlencoded') {
    return {
      bodyType: 'form',
      body: (body.urlencoded || []).map((r) => `${r.key}=${r.value}`).join('&'),
    };
  }
  if (body.mode === 'formdata') {
    return {
      bodyType: 'multipart',
      body: (body.formdata || []).map((r) => `${r.key}=${r.value || ''}`).join('\n'),
    };
  }
  return { bodyType: 'text', body: JSON.stringify(body) };
}

function walkPostmanItems(items, acc = []) {
  (items || []).forEach((item) => {
    if (item.item) {
      acc.push({
        type: 'folder',
        id: Date.now() + Math.random(),
        name: item.name || 'Folder',
        items: walkPostmanItems(item.item, []),
      });
    } else if (item.request) {
      const req = item.request;
      const { bodyType, body } = fromPostmanBody(req.body);
      acc.push({
        type: 'request',
        id: Date.now() + Math.random(),
        name: item.name || req.url || 'Request',
        method: (req.method || 'GET').toUpperCase(),
        url: fromPostmanUrl(req.url),
        headers: headerList(req.header),
        bodyType,
        body,
        docs: item.request?.description || item.description || '',
      });
    }
  });
  return acc;
}

export function importPostman(data) {
  if (data.info && (data.item || data.requests)) {
    return [{
      id: Date.now(),
      name: data.info.name || 'Postman',
      description: data.info.description || '',
      items: walkPostmanItems(data.item || []),
      created: new Date().toISOString(),
    }];
  }
  return null;
}

export function importInsomnia(data) {
  const resources = Array.isArray(data) ? data : data.resources;
  if (!Array.isArray(resources)) return null;
  const byParent = new Map();
  resources.forEach((r) => {
    if (!r || r._type === 'workspace') return;
    const key = r.parentId || '';
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(r);
  });
  const workspace = resources.find((r) => r._type === 'workspace');
  const convert = (list) => (list || []).map((r) => {
    if (r._type === 'request_group') {
      return {
        type: 'folder',
        id: r._id || Date.now() + Math.random(),
        name: r.name || 'Folder',
        items: convert(byParent.get(r._id)),
      };
    }
    if (r._type !== 'request') return null;
    return {
      type: 'request',
      id: r._id || Date.now() + Math.random(),
      name: r.name,
      method: (r.method || 'GET').toUpperCase(),
      url: r.url || '',
      headers: headerList(r.headers),
      bodyType: r.body?.mimeType?.includes('json') ? 'json' : (r.body?.text ? 'text' : 'none'),
      body: r.body?.text || '',
    };
  }).filter(Boolean);
  const rootKey = workspace?._id || '';
  const items = convert(byParent.get(rootKey) || byParent.get('') || []);
  return [{
    id: Date.now(),
    name: workspace?.name || data.name || 'Insomnia',
    items,
    created: new Date().toISOString(),
  }];
}

export function importOpenApi(spec) {
  const paths = spec.paths || {};
  const foldersByTag = {};
  const untagged = [];
  Object.entries(paths).forEach(([path, ops]) => {
    Object.entries(ops).forEach(([method, op]) => {
      if (!op || typeof op !== 'object' || !['get', 'post', 'put', 'patch', 'delete', 'options', 'head'].includes(method)) {
        return;
      }
      const servers = spec.servers?.[0]?.url || '';
      const req = {
        type: 'request',
        id: `${method}_${path}_${Math.random().toString(36).slice(2, 6)}`,
        name: op.summary || op.operationId || `${method.toUpperCase()} ${path}`,
        method: method.toUpperCase(),
        url: `${servers}${path}`,
        headers: [{ key: 'Accept', value: 'application/json' }],
        bodyType: op.requestBody ? 'json' : 'none',
        body: op.requestBody ? '{}' : '',
        docs: op.description || '',
      };
      const tag = (op.tags && op.tags[0]) || 'default';
      foldersByTag[tag] = foldersByTag[tag] || [];
      foldersByTag[tag].push(req);
    });
  });
  const items = Object.entries(foldersByTag).map(([name, reqs]) => ({
    type: 'folder',
    id: name,
    name,
    items: reqs,
  }));
  return [{
    id: Date.now(),
    name: spec.info?.title || 'OpenAPI',
    description: spec.info?.description || '',
    items: items.length ? items : untagged,
    created: new Date().toISOString(),
  }];
}

function bruRequestFromText(text, fallbackName) {
  if (!text || !text.includes('meta {')) return null;
  const name = (text.match(/name:\s*(.+)/) || [])[1]?.trim() || fallbackName || 'Bruno';
  const method = (text.match(/method:\s*(\w+)/) || [])[1] || 'GET';
  const url = (text.match(/url:\s*(.+)/) || [])[1]?.trim() || '';
  const bodyMatch = text.match(/body:json\s*\{([\s\S]*?)\n\}/);
  return {
    type: 'request',
    id: Date.now() + Math.random(),
    name,
    method: method.toUpperCase(),
    url,
    bodyType: bodyMatch ? 'json' : 'none',
    body: bodyMatch ? bodyMatch[1].trim() : '',
  };
}

function nestBruPath(items, segments, req) {
  if (segments.length <= 1) {
    items.push(req);
    return;
  }
  const folderName = segments[0];
  let folder = items.find((i) => i.type === 'folder' && i.name === folderName);
  if (!folder) {
    folder = { type: 'folder', id: Date.now() + Math.random(), name: folderName, items: [] };
    items.push(folder);
  }
  nestBruPath(folder.items, segments.slice(1), req);
}

export function importBruno(text) {
  if (typeof text !== 'string') return null;
  const parts = [];
  const re = /===== ([^\n]+) =====\r?\n([\s\S]*?)(?=\r?\n===== |$)/g;
  let match;
  while ((match = re.exec(text))) parts.push({ path: match[1].trim(), body: match[2] });
  if (parts.length) {
    const firstSeg = parts[0].path.split(/[/\\]/)[0];
    const sharedRoot = parts.every((p) => p.path.split(/[/\\]/)[0] === firstSeg);
    const items = [];
    parts.forEach((p) => {
      const segs = p.path.replace(/\.bru$/i, '').split(/[/\\]/).filter(Boolean);
      const req = bruRequestFromText(p.body, segs[segs.length - 1]);
      if (!req) return;
      const rest = sharedRoot ? segs.slice(1) : segs;
      nestBruPath(items, rest, req);
    });
    if (!items.length) return null;
    return [{
      id: Date.now(),
      name: sharedRoot ? firstSeg.replace(/\.bru$/i, '') : 'Bruno',
      items,
      created: new Date().toISOString(),
    }];
  }
  const req = bruRequestFromText(text);
  if (!req) return null;
  return [{
    id: Date.now(),
    name: req.name,
    items: [req],
    created: new Date().toISOString(),
  }];
}

export function detectAndImport(raw) {
  let data = raw;
  if (typeof raw === 'string') {
    const bru = importBruno(raw);
    if (bru) return bru;
    data = JSON.parse(raw);
  }
  if (data.openapi || data.swagger) return importOpenApi(data);
  if (data.format === 'pingto' && Array.isArray(data.collections)) return data.collections;
  if (data.info && data.item) return importPostman(data);
  if (data.__export_format || data.resources || data._type === 'export') return importInsomnia(data);
  if (Array.isArray(data)) return data;
  if (data.name && (data.items || data.requests)) return [data];
  throw new Error('Unknown collection format');
}

export function importAs(format, raw) {
  if (!format || format === 'auto') return detectAndImport(raw);
  if (format === 'bruno') {
    const list = importBruno(typeof raw === 'string' ? raw : '');
    if (!list) throw new Error('Not a Bruno collection');
    return list;
  }
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (format === 'pingto') {
    if (!isNativePingto(data)) throw new Error('Not a PingTo JSON collection');
    return data.collections;
  }
  if (format === 'postman') {
    const list = importPostman(data);
    if (!list) throw new Error('Not a Postman collection');
    return list;
  }
  if (format === 'insomnia') {
    const list = importInsomnia(data);
    if (!list) throw new Error('Not an Insomnia export');
    return list;
  }
  if (format === 'openapi') {
    if (!data.openapi && !data.swagger) throw new Error('Not an OpenAPI file');
    return importOpenApi(data);
  }
  return detectAndImport(raw);
}

export function isNativePingto(raw) {
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Boolean(data && data.format === 'pingto' && Array.isArray(data.collections));
  } catch {
    return false;
  }
}
