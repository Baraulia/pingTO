import { idsEqual, normalizeImportedCollections } from './request-utils.js';

export class CollectionsManager {
  constructor(storage) {
    this.storage = storage;
    this.key = 'api_collections';
    this.collections = [];
    this.loaded = false;
  }

  async load() {
    this.collections = await this.storage.get(this.key, []);
    if (!Array.isArray(this.collections)) this.collections = [];
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
    const collection = {
      id: Date.now(),
      name,
      requests: [],
      created: new Date().toISOString(),
    };
    this.collections.push(collection);
    await this.save();
    return collection;
  }

  async delete(id) {
    if (!this.loaded) await this.load();
    this.collections = this.collections.filter((c) => !idsEqual(c.id, id));
    await this.save();
  }

  async addRequest(collectionId, request) {
    if (!this.loaded) await this.load();
    const collection = this.collections.find((c) => idsEqual(c.id, collectionId));
    if (!collection) return false;
    collection.requests.push(request);
    await this.save();
    return true;
  }

  async removeRequest(collectionId, requestId) {
    if (!this.loaded) await this.load();
    const collection = this.collections.find((c) => idsEqual(c.id, collectionId));
    if (collection) {
      collection.requests = collection.requests.filter((r) => !idsEqual(r.id, requestId));
      await this.save();
    }
  }

  async import(data) {
    if (!this.loaded) await this.load();
    const incoming = normalizeImportedCollections(data);
    if (!incoming.length) {
      throw new Error('Invalid collection file');
    }
    this.collections = [...this.collections, ...incoming];
    await this.save();
    return incoming.length;
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
