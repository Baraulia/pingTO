function escapeJs(value) {
  return JSON.stringify(String(value ?? ''));
}

function escapePython(value) {
  return JSON.stringify(String(value ?? ''));
}

function escapePhp(value) {
  return String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function escapeGo(value) {
  return JSON.stringify(String(value ?? ''));
}

function asObject(headers) {
  if (!headers) return {};
  if (Array.isArray(headers)) {
    const obj = {};
    headers.forEach((h) => {
      if (h?.key) obj[h.key] = h.value ?? '';
    });
    return obj;
  }
  return headers;
}

export class CodeGenerator {
  static generateJavaScript(method, url, headers, body) {
    const hdrs = asObject(headers);
    let code = `fetch(${escapeJs(url)}, {\n`;
    code += `  method: ${escapeJs(method)},\n`;

    if (Object.keys(hdrs).length > 0) {
      code += `  headers: {\n`;
      Object.entries(hdrs).forEach(([key, value]) => {
        code += `    ${escapeJs(key)}: ${escapeJs(value)},\n`;
      });
      code += `  },\n`;
    }

    if (body) {
      code += `  body: ${escapeJs(body)},\n`;
    }

    code += `})\n`;
    code += `  .then(response => response.text())\n`;
    code += `  .then(data => console.log(data))\n`;
    code += `  .catch(error => console.error('Error:', error));`;
    return code;
  }

  static generatePython(method, url, headers, body) {
    const hdrs = asObject(headers);
    const methodName = String(method || 'get').toLowerCase();
    const safeMethod = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(methodName)
      ? methodName
      : 'request';

    let code = `import requests\n\n`;
    code += `url = ${escapePython(url)}\n`;
    code += `headers = {\n`;
    Object.entries(hdrs).forEach(([key, value]) => {
      code += `    ${escapePython(key)}: ${escapePython(value)},\n`;
    });
    code += `}\n`;

    if (body) {
      code += `data = ${escapePython(body)}\n`;
      if (safeMethod === 'request') {
        code += `response = requests.request(${escapePython(method)}, url, headers=headers, data=data)\n`;
      } else {
        code += `response = requests.${safeMethod}(url, headers=headers, data=data)\n`;
      }
    } else if (safeMethod === 'request') {
      code += `response = requests.request(${escapePython(method)}, url, headers=headers)\n`;
    } else {
      code += `response = requests.${safeMethod}(url, headers=headers)\n`;
    }

    code += `print(response.text)`;
    return code;
  }

  static generatePHP(method, url, headers, body) {
    const hdrs = asObject(headers);
    let code = `<?php\n\n`;
    code += `$ch = curl_init();\n`;
    code += `curl_setopt($ch, CURLOPT_URL, '${escapePhp(url)}');\n`;
    code += `curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);\n`;
    code += `curl_setopt($ch, CURLOPT_CUSTOMREQUEST, '${escapePhp(method)}');\n`;

    if (Object.keys(hdrs).length > 0) {
      code += `curl_setopt($ch, CURLOPT_HTTPHEADER, [\n`;
      Object.entries(hdrs).forEach(([key, value]) => {
        code += `    '${escapePhp(key)}: ${escapePhp(value)}',\n`;
      });
      code += `]);\n`;
    }

    if (body) {
      code += `curl_setopt($ch, CURLOPT_POSTFIELDS, '${escapePhp(body)}');\n`;
    }

    code += `$response = curl_exec($ch);\n`;
    code += `curl_close($ch);\n`;
    code += `echo $response;`;
    return code;
  }

  static generateGo(method, url, headers, body) {
    const hdrs = asObject(headers);
    let code = `package main\n\n`;
    code += `import (\n`;
    code += `    "bytes"\n`;
    code += `    "fmt"\n`;
    code += `    "io"\n`;
    code += `    "net/http"\n`;
    code += `)\n\n`;
    code += `func main() {\n`;
    code += `    client := &http.Client{}\n`;

    if (body) {
      code += `    jsonStr := []byte(${escapeGo(body)})\n`;
      code += `    req, err := http.NewRequest(${escapeGo(method)}, ${escapeGo(url)}, bytes.NewBuffer(jsonStr))\n`;
    } else {
      code += `    req, err := http.NewRequest(${escapeGo(method)}, ${escapeGo(url)}, nil)\n`;
    }

    code += `    if err != nil {\n`;
    code += `        fmt.Println(err)\n`;
    code += `        return\n`;
    code += `    }\n`;

    Object.entries(hdrs).forEach(([key, value]) => {
      code += `    req.Header.Set(${escapeGo(key)}, ${escapeGo(value)})\n`;
    });

    code += `    resp, err := client.Do(req)\n`;
    code += `    if err != nil {\n`;
    code += `        fmt.Println(err)\n`;
    code += `        return\n`;
    code += `    }\n`;
    code += `    defer resp.Body.Close()\n`;
    code += `    body, _ := io.ReadAll(resp.Body)\n`;
    code += `    fmt.Println(string(body))\n`;
    code += `}`;
    return code;
  }

  static generate(method, url, headers, body, language = 'javascript') {
    const generators = {
      javascript: this.generateJavaScript,
      python: this.generatePython,
      php: this.generatePHP,
      go: this.generateGo,
    };
    const generator = generators[language];
    return generator ? generator(method, url, headers, body) : 'Language not supported';
  }

  static getLanguages() {
    return ['javascript', 'python', 'php', 'go'];
  }

  static getLanguageLabel(lang) {
    const labels = {
      javascript: 'JavaScript (fetch)',
      python: 'Python (requests)',
      php: 'PHP (cURL)',
      go: 'Go (net/http)',
    };
    return labels[lang] || lang;
  }
}
