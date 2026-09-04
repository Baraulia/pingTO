function newId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function clonePlain(value, fallback) {
  if (value == null) return fallback;
  if (Array.isArray(value)) return value.map((row) => (row && typeof row === 'object' ? { ...row } : row));
  if (typeof value === 'object') return { ...value };
  return value;
}

export function emptyRequest(partial = {}) {
  return {
    type: 'request',
    id: partial.id || newId(),
    name: partial.name || 'New request',
    method: partial.method || 'GET',
    url: partial.url || '',
    headers: Array.isArray(partial.headers)
      ? clonePlain(partial.headers, [])
      : [{ key: 'Accept', value: 'application/json' }],
    params: clonePlain(partial.params, []),
    pathParams: clonePlain(partial.pathParams, []),
    bodyType: partial.bodyType || 'none',
    body: partial.body || '',
    authType: partial.authType || 'none',
    auth: clonePlain(partial.auth, {}),
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

export function flattenRequestsInScope(items, folderId = null) {
  if (!folderId) return flattenRequests(items);
  const folder = findItem(items, folderId);
  if (!folder || folder.type !== 'folder') return flattenRequests(items);
  return flattenRequests(folder.items);
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

export function ancestorFolderIds(items, childId) {
  const path = [];
  const walk = (list) => {
    for (const item of list || []) {
      if (String(item.id) === String(childId)) return true;
      if (item.type === 'folder') {
        path.push(item.id);
        if (walk(item.items)) return true;
        path.pop();
      }
    }
    return false;
  };
  return walk(items) ? path : [];
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

function normalizeTreeItem(item) {
  if (!item || typeof item !== 'object') return null;
  if (item.type === 'folder' || (Array.isArray(item.items) && item.type !== 'request')) {
    return {
      type: 'folder',
      id: item.id || newId(),
      name: item.name || 'Folder',
      authType: item.authType || 'inherit',
      auth: clonePlain(item.auth, {}),
      items: (item.items || []).map(normalizeTreeItem).filter(Boolean),
    };
  }
  return emptyRequest(item);
}

export function normalizeCollection(coll) {
  if (!coll || typeof coll !== 'object') return null;
  const rawItems = Array.isArray(coll.items)
    ? coll.items
    : (coll.requests || []).map((r) => ({ type: 'request', ...emptyRequest(r), ...r }));
  return {
    id: coll.id || Date.now(),
    name: coll.name || 'Collection',
    description: coll.description || '',
    authType: coll.authType || 'none',
    auth: clonePlain(coll.auth, {}),
    items: rawItems.map(normalizeTreeItem).filter(Boolean),
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
