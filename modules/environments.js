import { idsEqual } from './request-utils.js';

export class EnvironmentsManager {
  constructor(storage) {
    this.storage = storage;
    this.key = 'api_environments';
    this.environments = [];
    this.loaded = false;
  }

  async load() {
    this.environments = await this.storage.get(this.key, []);
    if (!Array.isArray(this.environments)) this.environments = [];
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
    return this.environments.find((e) => idsEqual(e.id, id));
  }

  async create(name, variables = {}) {
    if (!this.loaded) await this.load();
    const env = {
      id: Date.now(),
      name,
      variables,
      secrets: {},
      created: new Date().toISOString(),
    };
    this.environments.push(env);
    await this.save();
    return env;
  }

  async delete(id) {
    if (!this.loaded) await this.load();
    this.environments = this.environments.filter((e) => !idsEqual(e.id, id));
    await this.save();
  }

  async update(id, data) {
    if (!this.loaded) await this.load();
    const env = this.environments.find((e) => idsEqual(e.id, id));
    if (env) {
      Object.assign(env, data);
      await this.save();
    }
  }
}
