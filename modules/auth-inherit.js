import { ancestorFolderIds, findItem } from './collection-tree.js';

export function nodeAuth(node, fallback = 'none') {
  return {
    authType: node?.authType || fallback,
    auth: { ...(node?.auth || {}) },
  };
}

export function resolveInheritedAuth(collection, requestId, request = null, opts = {}) {
  const chain = [];
  if (collection) {
    chain.push(nodeAuth(collection, 'none'));
    let folderIds = [];
    if (requestId && findItem(collection.items, requestId)) {
      folderIds = ancestorFolderIds(collection.items, requestId);
    } else if (opts.folderId && findItem(collection.items, opts.folderId)) {
      folderIds = [...ancestorFolderIds(collection.items, opts.folderId), opts.folderId];
    }
    for (const fid of folderIds) {
      const folder = findItem(collection.items, fid);
      if (folder) chain.push(nodeAuth(folder, 'inherit'));
    }
  }
  if (request) chain.push(nodeAuth(request, 'none'));
  let resolved = { authType: 'none', auth: {} };
  for (const node of chain) {
    if (!node.authType || node.authType === 'inherit') continue;
    resolved = { authType: node.authType, auth: { ...node.auth } };
  }
  return resolved;
}
