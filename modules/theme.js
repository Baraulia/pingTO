// modules/theme.js
import { t } from './i18n.js';

export class ThemeManager {
  constructor() {
    this.dark = true;
    this.storageKey = 'api_theme';
  }

  async init() {
    const saved = await this.getSavedTheme();
    this.dark = saved !== 'light';
    this.apply();
  }

  async getSavedTheme() {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.storageKey], (result) => {
        resolve(result[this.storageKey] || 'dark');
      });
    });
  }

  async toggle() {
    this.dark = !this.dark;
    this.apply();
    await this.save();
  }

  async setDark(dark) {
    this.dark = Boolean(dark);
    this.apply();
    await this.save();
  }

  apply() {
    document.documentElement.setAttribute('data-theme', this.dark ? 'dark' : 'light');
    const btn = document.getElementById('themeToggle');
    if (btn) {
      btn.title = this.dark ? t('themeLight') : t('themeDark');
      btn.setAttribute('aria-label', btn.title);
    }
  }

  async save() {
    await chrome.storage.local.set({ [this.storageKey]: this.dark ? 'dark' : 'light' });
  }

  isDark() {
    return this.dark;
  }
}