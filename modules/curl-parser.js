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
    
    const methodMatch = cmd.match(/-X\s+(\w+)/);
    if (methodMatch) result.method = methodMatch[1];
    
    const urlMatch = cmd.match(/(?:'([^']*)'|"([^"]*)"|([^\s]+))$/);
    if (urlMatch) {
      result.url = urlMatch[1] || urlMatch[2] || urlMatch[3];
    }

    const headerRegex = /-H\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = headerRegex.exec(cmd)) !== null) {
      const [key, value] = match[1].split(':').map(s => s.trim());
      if (key && value) {
        result.headers.push({ key, value });
      }
    }

    const bodyMatch = cmd.match(/-d\s+['"]([^'"]+)['"]/);
    if (bodyMatch) {
      result.body = bodyMatch[1];
      if (!result.headers.find(h => h.key === 'Content-Type')) {
        result.headers.push({ key: 'Content-Type', value: 'application/json' });
      }
    }

    if (result.method === 'GET' && result.body) {
      result.method = 'POST';
    }

    return result;
  }

  static stringify(method, url, headers, body) {
    let cmd = `curl -X ${method}`;
    headers.forEach(h => {
      if (h.key && h.value) {
        cmd += ` -H '${h.key}: ${h.value}'`;
      }
    });
    if (body) {
      cmd += ` -d '${body}'`;
    }
    cmd += ` ${url}`;
    return cmd;
  }
}