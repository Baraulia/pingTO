export class CurlParser {
  static parse(curlString) {
    const result = {
      method: 'GET',
      url: '',
      headers: [],
      body: null,
    };

    const cmd = this.parseMultiline(curlString).replace(/^curl\s+/i, '').trim();
    if (!cmd) return result;

    const methodMatch = cmd.match(/(?:^|\s)(?:-X|--request)\s+(\w+)/i);
    if (methodMatch) result.method = methodMatch[1].toUpperCase();

    result.url = this.extractUrl(cmd);

    const headerRegex = /(?:-H|--header)\s+(?:'([^']*)'|"([^"]*)"|(\S+))/g;
    let match;
    while ((match = headerRegex.exec(cmd)) !== null) {
      const headerStr = match[1] || match[2] || match[3] || '';
      const colonIndex = headerStr.indexOf(':');
      if (colonIndex !== -1) {
        const key = headerStr.slice(0, colonIndex).trim();
        const value = headerStr.slice(colonIndex + 1).trim();
        if (key) result.headers.push({ key, value });
      }
    }

    const bodyRegex = /(?:-d|--data|--data-raw|--data-binary)\s+(?:'([^']*)'|"([^"]*)"|(\S+))/;
    const bodyMatch = cmd.match(bodyRegex);
    if (bodyMatch) {
      result.body = bodyMatch[1] || bodyMatch[2] || bodyMatch[3] || null;
      if (result.body && !result.headers.find((h) => h.key.toLowerCase() === 'content-type')) {
        result.headers.push({ key: 'Content-Type', value: 'application/json' });
      }
    }

    if (result.method === 'GET' && result.body) {
      result.method = 'POST';
    }

    return result;
  }

  static extractUrl(cmd) {
    const urlToken = cmd.match(/(?:^|\s)(?:'((?:https?:\/\/)[^']*)'|"((?:https?:\/\/)[^"]*)"|((?:https?:\/\/)\S+))/i);
    if (urlToken) return urlToken[1] || urlToken[2] || urlToken[3];

    const tokens = tokenizeCurl(cmd);
    const skipNext = new Set(['-X', '--request', '-H', '--header', '-d', '--data', '--data-raw', '--data-binary', '-o', '--output', '-A', '--user-agent', '-u', '--user']);
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (skipNext.has(token)) {
        i += 1;
        continue;
      }
      if (token.startsWith('-')) continue;
      return token.replace(/^['"]|['"]$/g, '');
    }
    return '';
  }

  static stringify(method, url, headers, body) {
    let cmd = `curl -X ${method}`;

    (headers || []).forEach((h) => {
      if (h.key && h.value) {
        const escapedValue = String(h.value).replace(/'/g, `'\\''`);
        cmd += ` -H '${h.key}: ${escapedValue}'`;
      }
    });

    if (body) {
      const escapedBody = String(body).replace(/'/g, `'\\''`);
      cmd += ` -d '${escapedBody}'`;
    }

    if (url) {
      cmd += ` '${url.replace(/'/g, `'\\''`)}'`;
    }

    return cmd;
  }

  static parseMultiline(curlString) {
    return String(curlString || '')
      .replace(/\\\r?\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  static validate(curlString) {
    const result = this.parse(curlString);
    return Boolean(result.url);
  }
}

function tokenizeCurl(cmd) {
  const tokens = [];
  const regex = /'([^']*)'|"([^"]*)"|(\S+)/g;
  let match;
  while ((match = regex.exec(cmd)) !== null) {
    tokens.push(match[1] ?? match[2] ?? match[3]);
  }
  return tokens;
}
