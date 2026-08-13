// modules/collections.js
export class CollectionsManager {
  constructor(storage) {
    this.storage = storage;
    this.key = 'api_collections';
    this.collections = [];
    this.loaded = false;
  }

  async load() {
    this.collections = await this.storage.get(this.key, []);
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
    return this.collections.find(c => c.id === id);
  }

  async create(name) {
    if (!this.loaded) await this.load();
    const collection = {
      id: Date.now(),
      name,
      requests: [],
      created: new Date().toISOString()
    };
    this.collections.push(collection);
    await this.save();
    return collection;
  }

  async delete(id) {
    if (!this.loaded) await this.load();
    this.collections = this.collections.filter(c => c.id !== id);
    await this.save();
  }

  async addRequest(collectionId, request) {
    if (!this.loaded) await this.load();
    const collection = this.collections.find(c => c.id === collectionId);
    if (collection) {
      collection.requests.push(request);
      await this.save();
    }
  }

  async removeRequest(collectionId, requestId) {
    if (!this.loaded) await this.load();
    const collection = this.collections.find(c => c.id === collectionId);
    if (collection) {
      collection.requests = collection.requests.filter(r => r.id !== requestId);
      await this.save();
    }
  }

  async import(data) {
    if (!this.loaded) await this.load();
    if (Array.isArray(data)) {
      this.collections = [...this.collections, ...data];
    } else {
      this.collections.push(data);
    }
    await this.save();
  }

  async exportAll() {
    if (!this.loaded) await this.load();
    return this.collections;
  }

  async exportCollection(id) {
    if (!this.loaded) await this.load();
    return this.collections.find(c => c.id === id);
  }
}