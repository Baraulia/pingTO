// modules/i18n.js - система локализации с переключателем

const TRANSLATIONS = {
  en: null,
  ru: null
};

let currentLang = 'en';
let isLoaded = false;

// Загрузка переводов
async function loadTranslations(lang) {
  if (TRANSLATIONS[lang]) return TRANSLATIONS[lang];
  
  try {
    const response = await fetch(chrome.runtime.getURL(`_locales/${lang}/messages.json`));
    const data = await response.json();
    TRANSLATIONS[lang] = data;
    return data;
  } catch (error) {
    console.error(`Failed to load ${lang} translations:`, error);
    // Fallback to English
    if (lang !== 'en') {
      return loadTranslations('en');
    }
    return {};
  }
}

// Получение перевода
export function t(key, defaultValue = key) {
  const langData = TRANSLATIONS[currentLang];
  if (langData && langData[key]) {
    return langData[key].message;
  }
  // Try English fallback
  if (currentLang !== 'en' && TRANSLATIONS.en && TRANSLATIONS.en[key]) {
    return TRANSLATIONS.en[key].message;
  }
  return defaultValue;
}

// Установка языка
export async function setLanguage(lang) {
  if (lang === currentLang && isLoaded) return;
  
  currentLang = lang;
  await loadTranslations(lang);
  isLoaded = true;
  
  // Сохраняем в storage
  chrome.storage.local.set({ app_language: lang });
  
  // Обновляем UI
  applyTranslations();
  
  // Уведомляем подписчиков
  document.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
}

// Получение текущего языка
export function getCurrentLanguage() {
  return currentLang;
}

// Применение переводов к DOM
export function applyTranslations() {
  document.documentElement.lang = currentLang;

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const pack = TRANSLATIONS[currentLang] || TRANSLATIONS.en;
    if (pack && pack[key]?.message) {
      el.textContent = pack[key].message;
    }
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    const pack = TRANSLATIONS[currentLang] || TRANSLATIONS.en;
    if (pack && pack[key]?.message) {
      el.placeholder = pack[key].message;
    }
  });

  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const key = el.getAttribute('data-i18n-title');
    const pack = TRANSLATIONS[currentLang] || TRANSLATIONS.en;
    if (pack && pack[key]?.message) {
      el.title = pack[key].message;
    }
  });

  const langBtn = document.getElementById('languageToggle');
  if (langBtn) {
    langBtn.textContent = currentLang === 'en' ? 'RU' : 'EN';
    langBtn.title = currentLang === 'en' ? t('languageRu') : t('languageEn');
  }
}

// Инициализация
export async function initI18n() {
  // Загружаем сохранённый язык
  const saved = await new Promise((resolve) => {
    chrome.storage.local.get(['app_language'], (result) => {
      resolve(result.app_language || 'en');
    });
  });
  
  currentLang = saved;
  await Promise.all([loadTranslations('en'), loadTranslations(currentLang)]);
  isLoaded = true;
  applyTranslations();
  return currentLang;
}

// Переключение языка
export async function toggleLanguage() {
  const newLang = currentLang === 'en' ? 'ru' : 'en';
  await setLanguage(newLang);
}

// Экспортируем как объект для совместимости с другим кодом
export const I18nManager = {
  init: initI18n,
  t,
  setLanguage,
  getCurrentLanguage,
  toggle: toggleLanguage,
  apply: applyTranslations
};