// modules/theme.js
export class ThemeManager {
  constructor() {
    this.dark = false;
    this.storageKey = 'api_theme';
  }

  async init() {
    const saved = await this.getSavedTheme();
    this.dark = saved === 'dark';
    this.apply();
  }

  async getSavedTheme() {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.storageKey], (result) => {
        resolve(result[this.storageKey] || 'light');
      });
    });
  }

  async toggle() {
    this.dark = !this.dark;
    this.apply();
    await this.save();
  }

  apply() {
    document.documentElement.setAttribute('data-theme', this.dark ? 'dark' : 'light');
  }

  async save() {
    await chrome.storage.local.set({ [this.storageKey]: this.dark ? 'dark' : 'light' });
  }

  isDark() {
    return this.dark;
  }
}