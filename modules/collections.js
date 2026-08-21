import { idsEqual } from './request-utils.js';
import { normalizeCollection, addItem, removeItem, flattenRequests, findItem, emptyRequest, newId, moveItem } from './collection-tree.js';

export class CollectionsManager {
  constructor(storage) {
    this.storage = storage;
    this.key = 'api_collections';
    this.collections = [];
    this.loaded = false;
  }

  async load() {
    const raw = await this.storage.get(this.key, []);
    this.collections = (Array.isArray(raw) ? raw : []).map((c) => normalizeCollection(c)).filter(Boolean);
    this.loaded = true;
    return this.collections;
  }

  async save() {
    await this.storage.set(this.key, this.collections);
  }

  async getAll() {
    if (!this.loaded) await this.load();
    return this.collections;
  }

  async getById(id) {
    if (!this.loaded) await this.load();
    return this.collections.find((c) => idsEqual(c.id, id));
  }

  async create(name) {
    if (!this.loaded) await this.load();
    const collection = normalizeCollection({
      id: Date.now(),
      name,
      items: [],
      created: new Date().toISOString(),
    });
    this.collections.push(collection);
    await this.save();
    return collection;
  }

  async delete(id) {
    if (!this.loaded) await this.load();
    this.collections = this.collections.filter((c) => !idsEqual(c.id, id));
    await this.save();
  }

  async addRequest(collectionId, request, folderId = null) {
    if (!this.loaded) await this.load();
    const collection = this.collections.find((c) => idsEqual(c.id, collectionId));
    if (!collection) return null;
    collection.items = collection.items || [];
    const stored = {
      type: 'request',
      ...emptyRequest(request),
      ...request,
      id: request.id || newId(),
      type: 'request',
    };
    delete stored.collectionId;
    delete stored.collectionItemId;
    delete stored.files;
    delete stored.binary;
    delete stored.response;
    delete stored.testResults;
    delete stored.snapshot;
    addItem(collection.items, folderId, stored);
    await this.save();
    return stored;
  }

  async updateRequest(collectionId, requestId, request) {
    if (!this.loaded) await this.load();
    const collection = this.collections.find((c) => idsEqual(c.id, collectionId));
    if (!collection) return false;
    const item = findItem(collection.items, requestId);
    if (!item || item.type === 'folder') return false;
    const next = { ...request };
    delete next.collectionId;
    delete next.collectionItemId;
    delete next.files;
    delete next.binary;
    delete next.response;
    delete next.testResults;
    delete next.snapshot;
    Object.assign(item, next, { type: 'request', id: requestId });
    await this.save();
    return true;
  }

  async rename(id, name) {
    if (!this.loaded) await this.load();
    const collection = this.collections.find((c) => idsEqual(c.id, id));
    if (!collection) return false;
    collection.name = String(name || '').trim() || collection.name;
    await this.save();
    return true;
  }

  async renameItem(collectionId, itemId, name) {
    if (!this.loaded) await this.load();
    const collection = this.collections.find((c) => idsEqual(c.id, collectionId));
    if (!collection) return false;
    const item = findItem(collection.items, itemId);
    if (!item) return false;
    item.name = String(name || '').trim() || item.name;
    await this.save();
    return true;
  }

  async moveItem(collectionId, itemId, targetFolderId = null) {
    if (!this.loaded) await this.load();
    const collection = this.collections.find((c) => idsEqual(c.id, collectionId));
    if (!collection) return false;
    const ok = moveItem(collection.items, itemId, targetFolderId || null);
    if (ok) await this.save();
    return ok;
  }

  async addFolder(collectionId, name, parentId = null) {
    if (!this.loaded) await this.load();
    const collection = this.collections.find((c) => idsEqual(c.id, collectionId));
    if (!collection) return false;
    addItem(collection.items, parentId, { type: 'folder', id: Date.now(), name, items: [] });
    await this.save();
    return true;
  }

  async removeItem(collectionId, itemId) {
    if (!this.loaded) await this.load();
    const collection = this.collections.find((c) => idsEqual(c.id, collectionId));
    if (!collection) return;
    removeItem(collection.items, itemId);
    await this.save();
  }

  flatten(collectionId) {
    const collection = this.collections.find((c) => idsEqual(c.id, collectionId));
    return collection ? flattenRequests(collection.items) : [];
  }

  async importMany(list) {
    if (!this.loaded) await this.load();
    const incoming = (list || []).map((c) => normalizeCollection(c)).filter(Boolean);
    if (!incoming.length) throw new Error('Nothing to import');
    this.collections = [...this.collections, ...incoming];
    await this.save();
    return incoming.length;
  }

  async import(data) {
    return this.importMany(Array.isArray(data) ? data : [data]);
  }

  async exportAll() {
    if (!this.loaded) await this.load();
    return this.collections;
  }

  async exportCollection(id) {
    if (!this.loaded) await this.load();
    return this.collections.find((c) => idsEqual(c.id, id));
  }

  async exportOne(id) {
    return this.exportCollection(id);
  }
}
