// modules/environments.js
export class EnvironmentsManager {
  constructor(storage) {
    this.storage = storage;
    this.key = 'api_environments';
    this.environments = [];
    this.loaded = false;
  }

  async load() {
    this.environments = await this.storage.get(this.key, []);
    this.loaded = true;
    return this.environments;
  }

  async save() {
    await this.storage.set(this.key, this.environments);
  }

  async getAll() {
    if (!this.loaded) await this.load();
    return this.environments;
  }

  async getById(id) {
    if (!this.loaded) await this.load();
    return this.environments.find(e => e.id === id);
  }

  async create(name, variables = {}) {
    if (!this.loaded) await this.load();
    const env = {
      id: Date.now(),
      name,
      variables,
      created: new Date().toISOString()
    };
    this.environments.push(env);
    await this.save();
    return env;
  }

  async delete(id) {
    if (!this.loaded) await this.load();
    this.environments = this.environments.filter(e => e.id !== id);
    await this.save();
  }

  async update(id, data) {
    if (!this.loaded) await this.load();
    const env = this.environments.find(e => e.id === id);
    if (env) {
      Object.assign(env, data);
      await this.save();
    }
  }
}