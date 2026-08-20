function headerList(headers) {
  if (!headers) return [];
  if (Array.isArray(headers)) return headers.filter((h) => h?.key);
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
  const resources = data.resources || data;
  if (!Array.isArray(resources)) return null;
  const folders = resources.filter((r) => r._type === 'request_group');
  const requests = resources.filter((r) => r._type === 'request');
  const items = [];
  folders.forEach((f) => {
    items.push({
      type: 'folder',
      id: f._id || Date.now(),
      name: f.name || 'Folder',
      items: requests
        .filter((r) => r.parentId === f._id)
        .map((r) => ({
          type: 'request',
          id: r._id,
          name: r.name,
          method: r.method,
          url: r.url,
          headers: headerList(r.headers),
          bodyType: r.body?.mimeType?.includes('json') ? 'json' : 'text',
          body: r.body?.text || '',
        })),
    });
  });
  const orphans = requests.filter((r) => !folders.some((f) => f._id === r.parentId));
  orphans.forEach((r) => {
    items.push({
      type: 'request',
      id: r._id,
      name: r.name,
      method: r.method,
      url: r.url,
      headers: headerList(r.headers),
      body: r.body?.text || '',
    });
  });
  return [{
    id: Date.now(),
    name: data.name || 'Insomnia',
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

export function importBruno(text) {
  if (typeof text !== 'string' || !text.includes('meta {')) return null;
  const name = (text.match(/name:\s*(.+)/) || [])[1]?.trim() || 'Bruno';
  const method = (text.match(/method:\s*(\w+)/) || [])[1] || 'GET';
  const url = (text.match(/url:\s*(.+)/) || [])[1]?.trim() || '';
  const bodyMatch = text.match(/body:json\s*\{([\s\S]*?)\n\}/);
  return [{
    id: Date.now(),
    name,
    items: [{
      type: 'request',
      id: Date.now() + 1,
      name,
      method: method.toUpperCase(),
      url,
      bodyType: bodyMatch ? 'json' : 'none',
      body: bodyMatch ? bodyMatch[1].trim() : '',
    }],
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
