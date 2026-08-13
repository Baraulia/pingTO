// modules/storage.js
export class StorageManager {
  constructor() {
    this.storage = chrome.storage.local;
  }

  async get(key, defaultValue = null) {
    return new Promise((resolve) => {
      this.storage.get([key], (result) => {
        resolve(result[key] !== undefined ? result[key] : defaultValue);
      });
    });
  }

  async set(key, value) {
    return new Promise((resolve) => {
      this.storage.set({ [key]: value }, resolve);
    });
  }

  async remove(key) {
    return new Promise((resolve) => {
      this.storage.remove(key, resolve);
    });
  }

  async clear() {
    return new Promise((resolve) => {
      this.storage.clear(resolve);
    });
  }
}