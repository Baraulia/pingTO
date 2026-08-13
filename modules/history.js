// modules/history.js
export class HistoryManager {
  constructor(storage) {
    this.storage = storage;
    this.key = 'api_history';
    this.items = [];
    this.loaded = false;
  }

  async load() {
    this.items = await this.storage.get(this.key, []);
    this.loaded = true;
    return this.items;
  }

  async add(item) {
    if (!this.loaded) await this.load();
    item.id = Date.now() + Math.random() * 1000;
    this.items.unshift(item);
    await this.save();
  }

  async save() {
    await this.storage.set(this.key, this.items);
  }

  getItems(limit = 50) {
    if (!this.loaded) return [];
    return this.items.slice(0, limit);
  }

  getById(id) {
    return this.items.find(item => item.id === id);
  }

  async clear() {
    this.items = [];
    await this.save();
  }

  getAll() {
    return this.items;
  }
}