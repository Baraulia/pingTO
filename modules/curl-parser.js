// modules/curl-parser.js
export class CurlParser {
  static parse(curlString) {
    const result = {
      method: 'GET',
      url: '',
      headers: [],
      body: null
    };

    let cmd = curlString.replace(/^curl\s+/, '');
    
    // Парсинг метода
    const methodMatch = cmd.match(/-X\s+(\w+)/);
    if (methodMatch) result.method = methodMatch[1];
    
    // Парсинг URL (поддерживает кавычки и без них)
    const urlMatch = cmd.match(/(?:'([^']*)'|"([^"]*)"|([^\s]+))$/);
    if (urlMatch) {
      result.url = urlMatch[1] || urlMatch[2] || urlMatch[3];
    }

    // Парсинг заголовков - ИСПРАВЛЕННАЯ ВЕРСИЯ
    // Поддерживает как -H 'Header: Value', так и --header 'Header: Value'
    const headerRegex = /(?:-H|--header)\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = headerRegex.exec(cmd)) !== null) {
      const headerStr = match[1];
      // Находим первое двоеточие для разделения ключа и значения
      const colonIndex = headerStr.indexOf(':');
      if (colonIndex !== -1) {
        const key = headerStr.slice(0, colonIndex).trim();
        const value = headerStr.slice(colonIndex + 1).trim();
        if (key && value) {
          result.headers.push({ key, value });
        }
      }
    }

    // Парсинг тела запроса (поддерживает -d, --data, --data-raw)
    const bodyRegex = /(?:-d|--data|--data-raw)\s+['"]([^'"]+)['"]/;
    const bodyMatch = cmd.match(bodyRegex);
    if (bodyMatch) {
      result.body = bodyMatch[1];
      // Добавляем Content-Type если не указан
      if (!result.headers.find(h => h.key.toLowerCase() === 'content-type')) {
        result.headers.push({ key: 'Content-Type', value: 'application/json' });
      }
    }

    // Если есть тело, но метод GET - меняем на POST
    if (result.method === 'GET' && result.body) {
      result.method = 'POST';
    }

    return result;
  }

  static stringify(method, url, headers, body) {
    let cmd = `curl -X ${method}`;
    
    // Добавляем заголовки с правильным экранированием
    headers.forEach(h => {
      if (h.key && h.value) {
        // Экранируем одинарные кавычки в значении
        const escapedValue = h.value.replace(/'/g, "'\\''");
        cmd += ` -H '${h.key}: ${escapedValue}'`;
      }
    });
    
    // Добавляем тело с правильным экранированием
    if (body) {
      const escapedBody = body.replace(/'/g, "'\\''");
      cmd += ` -d '${escapedBody}'`;
    }
    
    // Добавляем URL (если содержит пробелы или спецсимволы - в кавычках)
    if (url) {
      if (url.includes(' ') || url.includes('&') || url.includes('?')) {
        cmd += ` "${url}"`;
      } else {
        cmd += ` ${url}`;
      }
    }
    
    return cmd;
  }

  // Дополнительный метод для парсинга с поддержкой многострочных запросов
  static parseMultiline(curlString) {
    // Удаляем переносы строк и лишние пробелы
    const cleaned = curlString.replace(/\s+/g, ' ').trim();
    return this.parse(cleaned);
  }

  // Метод для валидации cURL команды
  static validate(curlString) {
    try {
      const result = this.parse(curlString);
      return result.url && result.url.length > 0;
    } catch (error) {
      return false;
    }
  }

  // Метод для извлечения всех заголовков с поддержкой дублирующихся ключей
  static parseHeaders(headerString) {
    const headers = [];
    const lines = headerString.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      const colonIndex = trimmed.indexOf(':');
      if (colonIndex !== -1) {
        const key = trimmed.slice(0, colonIndex).trim();
        const value = trimmed.slice(colonIndex + 1).trim();
        if (key) {
          headers.push({ key, value });
        }
      }
    }
    
    return headers;
  }
}