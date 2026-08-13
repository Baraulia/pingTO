// modules/api-client.js - основной клиент для HTTP запросов

export class ApiClient {
  constructor() {
    this.defaultHeaders = {
      'User-Agent': 'API-Client-Pro/2.0'
    };
    this.timeout = 30000; // 30 секунд
  }

  /**
   * Отправка HTTP запроса через background service worker
   */
  async sendRequest({ method, url, headers = {}, body = null, timeout = this.timeout }) {
    const startTime = performance.now();

    try {
      // Объединяем заголовки
      const allHeaders = {
        ...this.defaultHeaders,
        ...headers
      };

      // Создаём AbortController для таймаута
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      // Отправляем запрос через background
      const response = await chrome.runtime.sendMessage({
        type: 'sendRequest',
        data: {
          method,
          url,
          headers: allHeaders,
          body,
          signal: controller.signal
        }
      });

      clearTimeout(timeoutId);

      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);

      return this.formatResponse(response, duration);
    } catch (error) {
      if (error.name === 'AbortError') {
        return this.formatError('Request timeout', 'Timeout');
      }
      return this.formatError(error.message, 'Network Error');
    }
  }

  /**
   * Форматирование успешного ответа
   */
  formatResponse(response, duration) {
    if (response.error) {
      return this.formatError(response.error, response.statusText || 'Error');
    }

    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers || {},
      body: response.body || '',
      time: duration,
      size: response.size || 0,
      contentType: response.headers?.['content-type'] || '',
      data: null // Для JSON будет парситься отдельно
    };
  }

  /**
   * Форматирование ошибки
   */
  formatError(message, statusText = 'Error') {
    return {
      ok: false,
      status: 0,
      statusText: statusText,
      headers: {},
      body: message,
      time: 0,
      size: 0,
      contentType: '',
      error: message,
      data: null
    };
  }

  /**
   * Парсинг JSON ответа
   */
  parseJson(body) {
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  }

  /**
   * Проверка на JSON
   */
  isJson(contentType) {
    return contentType?.includes('application/json') || false;
  }

  /**
   * Получение body в разных форматах
   */
  prepareBody(body, type) {
    if (!body) return null;

    switch (type) {
      case 'json':
        try {
          // Проверяем, что это валидный JSON
          JSON.parse(body);
          return body;
        } catch {
          throw new Error('Invalid JSON');
        }
      case 'form':
        return body;
      case 'multipart':
        return body;
      case 'graphql':
        try {
          const parsed = JSON.parse(body);
          return JSON.stringify(parsed);
        } catch {
          return body;
        }
      case 'text':
      default:
        return body;
    }
  }

  /**
   * Проверка URL
   */
  validateUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Добавление параметров к URL
   */
  addParams(url, params) {
    const urlObj = new URL(url);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        urlObj.searchParams.append(key, value);
      }
    });
    return urlObj.toString();
  }

  /**
   * Получение информации об ответе
   */
  getResponseInfo(response) {
    const size = response.size || 0;
    const time = response.time || 0;

    return {
      size: size < 1024 ? `${size}B` : size < 1048576 ? `${(size / 1024).toFixed(2)}KB` : `${(size / 1048576).toFixed(2)}MB`,
      time: time < 1000 ? `${time}ms` : `${(time / 1000).toFixed(2)}s`
    };
  }
}

// Экспорт синглтона
export const apiClient = new ApiClient();