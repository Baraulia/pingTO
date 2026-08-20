export class StorageManager {
  constructor() {
    this.storage = chrome.storage.local;
  }

  async get(key, defaultValue = null) {
    return new Promise((resolve, reject) => {
      this.storage.get([key], (result) => {
        const err = chrome.runtime.lastError;
        if (err) {
          reject(new Error(err.message));
          return;
        }
        resolve(result[key] !== undefined ? result[key] : defaultValue);
      });
    });
  }

  async set(key, value) {
    return new Promise((resolve, reject) => {
      this.storage.set({ [key]: value }, () => {
        const err = chrome.runtime.lastError;
        if (err) {
          reject(new Error(err.message));
          return;
        }
        resolve();
      });
    });
  }

  async remove(key) {
    return new Promise((resolve, reject) => {
      this.storage.remove(key, () => {
        const err = chrome.runtime.lastError;
        if (err) {
          reject(new Error(err.message));
          return;
        }
        resolve();
      });
    });
  }

  async clear() {
    return new Promise((resolve, reject) => {
      this.storage.clear(() => {
        const err = chrome.runtime.lastError;
        if (err) {
          reject(new Error(err.message));
          return;
        }
        resolve();
      });
    });
  }
}
