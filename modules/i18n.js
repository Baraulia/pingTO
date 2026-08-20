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
  // Все элементы с data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const translation = t(key);
    if (translation) {
      el.textContent = translation;
    }
  });

  // Плейсхолдеры
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const translation = t(key);
    if (translation) {
      el.placeholder = translation;
    }
  });

  // Title
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    const translation = t(key);
    if (translation) {
      el.title = translation;
    }
  });

  // Option элементы в select
  document.querySelectorAll('select').forEach(select => {
    select.querySelectorAll('option[data-i18n]').forEach(opt => {
      const key = opt.getAttribute('data-i18n');
      const translation = t(key);
      if (translation) {
        opt.textContent = translation;
      }
    });
  });

  // Обновляем кнопку переключения языка
  const langBtn = document.getElementById('languageToggle');
  if (langBtn) {
    langBtn.textContent = currentLang === 'en' ? 'en' : '🇷🇺';
    langBtn.title = currentLang === 'en' ? 'Switch to Russian' : 'Переключить на английский';
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
  await loadTranslations(currentLang);
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