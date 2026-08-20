import { idsEqual } from './request-utils.js';
import { normalizeCollection, addItem, removeItem, flattenRequests } from './collection-tree.js';

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
    if (!collection) return false;
    collection.items = collection.items || [];
    addItem(collection.items, folderId, { type: 'request', ...request });
    await this.save();
    return true;
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
