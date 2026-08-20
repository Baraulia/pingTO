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
      curl: this.generateCurl,
      typescript: this.generateTypeScript,
      csharp: this.generateCSharp,
      java: this.generateJava,
    };
    const generator = generators[language];
    return generator ? generator(method, url, headers, body) : 'Language not supported';
  }

  static generateCurl(method, url, headers, body) {
    const hdrs = asObject(headers);
    let cmd = `curl -X ${method} ${JSON.stringify(url)}`;
    Object.entries(hdrs).forEach(([key, value]) => {
      cmd += ` \\\n  -H ${JSON.stringify(`${key}: ${value}`)}`;
    });
    if (body) cmd += ` \\\n  --data-raw ${JSON.stringify(body)}`;
    return cmd;
  }

  static generateTypeScript(method, url, headers, body) {
    const hdrs = asObject(headers);
    return `const res = await fetch(${JSON.stringify(url)}, {
  method: ${JSON.stringify(method)},
  headers: ${JSON.stringify(hdrs, null, 2)},
${body ? `  body: ${JSON.stringify(body)},\n` : ''}});
const text = await res.text();
console.log(res.status, text);`;
  }

  static generateCSharp(method, url, headers, body) {
    const hdrs = asObject(headers);
    let code = `using var client = new HttpClient();\n`;
    Object.entries(hdrs).forEach(([key, value]) => {
      code += `client.DefaultRequestHeaders.TryAddWithoutValidation(${JSON.stringify(key)}, ${JSON.stringify(value)});\n`;
    });
    if (body) {
      code += `var content = new StringContent(${JSON.stringify(body)}, System.Text.Encoding.UTF8, "application/json");\n`;
      code += `var response = await client.SendAsync(new HttpRequestMessage(HttpMethod.${method[0] + method.slice(1).toLowerCase()}, ${JSON.stringify(url)}) { Content = content });\n`;
    } else {
      code += `var response = await client.SendAsync(new HttpRequestMessage(HttpMethod.${method[0] + method.slice(1).toLowerCase()}, ${JSON.stringify(url)}));\n`;
    }
    code += `Console.WriteLine(await response.Content.ReadAsStringAsync());`;
    return code;
  }

  static generateJava(method, url, headers, body) {
    const hdrs = asObject(headers);
    let code = `var client = HttpClient.newHttpClient();\nvar builder = HttpRequest.newBuilder()\n    .uri(URI.create(${JSON.stringify(url)}))\n    .method(${JSON.stringify(method)}, ${body ? `HttpRequest.BodyPublishers.ofString(${JSON.stringify(body)})` : 'HttpRequest.BodyPublishers.noBody()'});\n`;
    Object.entries(hdrs).forEach(([key, value]) => {
      code += `builder.header(${JSON.stringify(key)}, ${JSON.stringify(value)});\n`;
    });
    code += `var response = client.send(builder.build(), HttpResponse.BodyHandlers.ofString());\nSystem.out.println(response.body());`;
    return code;
  }

  static getLanguages() {
    return ['javascript', 'typescript', 'python', 'php', 'go', 'curl', 'csharp', 'java'];
  }

  static getLanguageLabel(lang) {
    const labels = {
      javascript: 'JavaScript (fetch)',
      typescript: 'TypeScript',
      python: 'Python (requests)',
      php: 'PHP (cURL)',
      go: 'Go (net/http)',
      curl: 'cURL',
      csharp: 'C# (HttpClient)',
      java: 'Java (HttpClient)',
    };
    return labels[lang] || lang;
  }
}
