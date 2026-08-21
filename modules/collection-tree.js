function newId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyRequest(partial = {}) {
  return {
    type: 'request',
    id: newId(),
    name: partial.name || 'New request',
    method: partial.method || 'GET',
    url: partial.url || '',
    headers: partial.headers || [{ key: 'Accept', value: 'application/json' }],
    params: partial.params || [],
    pathParams: partial.pathParams || [],
    bodyType: partial.bodyType || 'none',
    body: partial.body || '',
    authType: partial.authType || 'none',
    auth: partial.auth || {},
    preRequest: partial.preRequest || '',
    tests: partial.tests || '',
    docs: partial.docs || '',
    graphqlQuery: partial.graphqlQuery || '',
    graphqlVariables: partial.graphqlVariables || '',
    followRedirects: partial.followRedirects !== false,
    description: partial.description || '',
  };
}

export function walkItems(items, visit) {
  (items || []).forEach((item) => {
    visit(item);
    if (item.type === 'folder') walkItems(item.items, visit);
  });
}

export function flattenRequests(items) {
  const out = [];
  walkItems(items, (item) => {
    if (item.type !== 'folder') out.push(item);
  });
  return out;
}

export function findItem(items, id) {
  for (const item of items || []) {
    if (String(item.id) === String(id)) return item;
    if (item.type === 'folder') {
      const found = findItem(item.items, id);
      if (found) return found;
    }
  }
  return null;
}

export function removeItem(items, id) {
  const list = items || [];
  const idx = list.findIndex((i) => String(i.id) === String(id));
  if (idx !== -1) {
    list.splice(idx, 1);
    return true;
  }
  for (const item of list) {
    if (item.type === 'folder' && removeItem(item.items, id)) return true;
  }
  return false;
}

export function addItem(items, parentId, item) {
  if (!parentId) {
    items.push(item);
    return;
  }
  const folder = findItem(items, parentId);
  if (folder && folder.type === 'folder') {
    folder.items = folder.items || [];
    folder.items.push(item);
  } else {
    items.push(item);
  }
}

export function findParentId(items, childId, parentId = null) {
  for (const item of items || []) {
    if (String(item.id) === String(childId)) return parentId;
    if (item.type === 'folder') {
      const found = findParentId(item.items, childId, item.id);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

export function moveItem(items, itemId, targetFolderId = null) {
  const item = findItem(items, itemId);
  if (!item) return false;
  if (targetFolderId && String(itemId) === String(targetFolderId)) return false;
  if (item.type === 'folder' && targetFolderId && findItem(item.items, targetFolderId)) return false;
  const currentParent = findParentId(items, itemId);
  if (currentParent === undefined) return false;
  if (String(currentParent ?? '') === String(targetFolderId ?? '')) return true;
  if (!removeItem(items, itemId)) return false;
  addItem(items, targetFolderId, item);
  return true;
}

export function normalizeCollection(coll) {
  if (!coll || typeof coll !== 'object') return null;
  const items = Array.isArray(coll.items)
    ? coll.items
    : (coll.requests || []).map((r) => ({ type: 'request', ...emptyRequest(r), ...r }));
  return {
    id: coll.id || Date.now(),
    name: coll.name || 'Collection',
    description: coll.description || '',
    items,
    created: coll.created || new Date().toISOString(),
  };
}

export function searchRequests(collections, query) {
  const q = String(query || '').toLowerCase().trim();
  if (!q) return [];
  const hits = [];
  collections.forEach((coll) => {
    flattenRequests(coll.items).forEach((req) => {
      const hay = `${req.name || ''} ${req.method || ''} ${req.url || ''} ${req.docs || ''}`.toLowerCase();
      if (hay.includes(q)) hits.push({ collection: coll, request: req });
    });
  });
  return hits.slice(0, 50);
}

export { newId };
