import { collectionToBruFiles, sanitizeExport } from './bruno-export.js';

function asList(collections) {
  return (Array.isArray(collections) ? collections : [collections]).filter(Boolean);
}

function pmKv(key, value) {
  return { key, value: value || '', type: 'string' };
}

export function toPostmanAuth(authType, auth = {}) {
  if (!authType || authType === 'inherit') return { type: 'inherit' };
  if (authType === 'none') return { type: 'noauth' };
  if (authType === 'bearer') return { type: 'bearer', bearer: [pmKv('token', auth.token)] };
  if (authType === 'basic') {
    return { type: 'basic', basic: [pmKv('username', auth.user), pmKv('password', auth.pass)] };
  }
  if (authType === 'apikey') {
    return {
      type: 'apikey',
      apikey: [pmKv('key', auth.apiKeyName), pmKv('value', auth.apiKeyValue), pmKv('in', auth.apiKeyIn || 'header')],
    };
  }
  if (authType === 'digest') {
    return { type: 'digest', digest: [pmKv('username', auth.user), pmKv('password', auth.pass)] };
  }
  if (authType === 'oauth2') {
    return {
      type: 'oauth2',
      oauth2: [
        pmKv('accessToken', auth.token),
        pmKv('accessTokenUrl', auth.tokenUrl),
        pmKv('authUrl', auth.authUrl),
        pmKv('clientId', auth.clientId),
        pmKv('clientSecret', auth.clientSecret),
        pmKv('scope', auth.scope),
        pmKv('grant_type', auth.grant || 'client_credentials'),
      ],
    };
  }
  return { type: 'noauth' };
}

function toPostmanBody(req) {
  if (!req?.body || req.bodyType === 'none') return undefined;
  if (req.bodyType === 'json' || req.bodyType === 'graphql') {
    return { mode: 'raw', raw: req.body, options: { raw: { language: 'json' } } };
  }
  if (req.bodyType === 'form') {
    return {
      mode: 'urlencoded',
      urlencoded: String(req.body).split('&').filter(Boolean).map((pair) => {
        const [key, ...rest] = pair.split('=');
        return { key, value: rest.join('=') };
      }),
    };
  }
  if (req.bodyType === 'multipart') {
    return {
      mode: 'formdata',
      formdata: String(req.body).split('\n').filter(Boolean).map((line) => {
        const [key, ...rest] = line.split('=');
        return { key, value: rest.join('=') };
      }),
    };
  }
  return { mode: 'raw', raw: req.body, options: { raw: { language: 'text' } } };
}

function toPostmanItems(items) {
  return (items || []).map((item) => {
    if (item.type === 'folder') {
      const folder = { name: item.name || 'Folder', item: toPostmanItems(item.items) };
      if (item.authType && item.authType !== 'inherit') folder.auth = toPostmanAuth(item.authType, item.auth);
      return folder;
    }
    const req = {
      name: item.name || item.url || 'Request',
      request: {
        method: item.method || 'GET',
        header: (item.headers || []).filter((h) => h.key).map((h) => ({ key: h.key, value: h.value || '' })),
        url: item.url || '',
        body: toPostmanBody(item),
        description: item.docs || '',
      },
    };
    if (item.authType && item.authType !== 'inherit') {
      req.request.auth = toPostmanAuth(item.authType, item.auth);
    }
    return req;
  });
}

export function toPostman(collections) {
  const list = asList(collections).map((c) => sanitizeExport(c));
  const schema = 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json';
  if (list.length === 1) {
    const out = {
      info: { name: list[0].name || 'PingTo', schema },
      item: toPostmanItems(list[0].items),
    };
    if (list[0].authType && list[0].authType !== 'inherit' && list[0].authType !== 'none') {
      out.auth = toPostmanAuth(list[0].authType, list[0].auth);
    }
    return out;
  }
  return {
    info: { name: 'PingTo export', schema },
    item: list.map((c) => {
      const node = { name: c.name || 'Collection', item: toPostmanItems(c.items) };
      if (c.authType && c.authType !== 'inherit' && c.authType !== 'none') {
        node.auth = toPostmanAuth(c.authType, c.auth);
      }
      return node;
    }),
  };
}

function insomniaId(prefix, value) {
  return `${prefix}_${String(value || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 24) || Math.random().toString(36).slice(2, 8)}`;
}

function insomniaBody(req) {
  if (!req?.body || req.bodyType === 'none') return {};
  if (req.bodyType === 'json' || req.bodyType === 'graphql') {
    return { mimeType: 'application/json', text: req.body };
  }
  return { mimeType: 'text/plain', text: req.body };
}

function walkInsomnia(items, parentId, resources) {
  (items || []).forEach((item) => {
    if (item.type === 'folder') {
      const id = insomniaId('fld', item.id || item.name);
      resources.push({ _id: id, _type: 'request_group', parentId, name: item.name || 'Folder' });
      walkInsomnia(item.items, id, resources);
      return;
    }
    resources.push({
      _id: insomniaId('req', item.id || item.name),
      _type: 'request',
      parentId,
      name: item.name || item.url || 'Request',
      method: item.method || 'GET',
      url: item.url || '',
      headers: (item.headers || []).filter((h) => h.key).map((h) => ({ name: h.key, value: h.value || '' })),
      body: insomniaBody(item),
    });
  });
}

export function toInsomnia(collections) {
  const list = asList(collections).map((c) => sanitizeExport(c));
  const resources = [];
  const wsId = 'wrk_pingto';
  resources.push({ _id: wsId, _type: 'workspace', parentId: null, name: 'PingTo' });
  list.forEach((c, i) => {
    const colId = insomniaId('fld', c.id || `c${i}`);
    resources.push({ _id: colId, _type: 'request_group', parentId: wsId, name: c.name || 'Collection' });
    walkInsomnia(c.items, colId, resources);
  });
  return {
    _type: 'export',
    __export_format: 4,
    __export_date: new Date().toISOString(),
    __export_source: 'pingto',
    resources,
  };
}

export function toPingto(collections) {
  return { format: 'pingto', version: 1, collections: asList(collections) };
}

export function toBrunoText(collections) {
  return asList(collections)
    .map((c) => sanitizeExport(c))
    .flatMap((c) => collectionToBruFiles(c))
    .map((f) => `===== ${f.path} =====\n${f.content}`)
    .join('\n\n');
}
