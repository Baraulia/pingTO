// modules/code-generator.js
export class CodeGenerator {
  static generateJavaScript(method, url, headers, body) {
    let code = `fetch('${url}', {\n`;
    code += `  method: '${method}',\n`;
    
    if (Object.keys(headers).length > 0) {
      code += `  headers: {\n`;
      Object.entries(headers).forEach(([key, value]) => {
        code += `    '${key}': '${value}',\n`;
      });
      code += `  },\n`;
    }
    
    if (body) {
      code += `  body: JSON.stringify(${body}),\n`;
    }
    
    code += `})\n`;
    code += `  .then(response => response.json())\n`;
    code += `  .then(data => console.log(data))\n`;
    code += `  .catch(error => console.error('Error:', error));`;
    
    return code;
  }

  static generatePython(method, url, headers, body) {
    let code = `import requests\n\n`;
    code += `url = '${url}'\n`;
    code += `headers = {\n`;
    Object.entries(headers).forEach(([key, value]) => {
      code += `    '${key}': '${value}',\n`;
    });
    code += `}\n`;
    
    if (body) {
      code += `data = ${body}\n`;
      code += `response = requests.${method.toLowerCase()}('${url}', headers=headers, json=data)\n`;
    } else {
      code += `response = requests.${method.toLowerCase()}('${url}', headers=headers)\n`;
    }
    
    code += `print(response.json())`;
    return code;
  }

  static generatePHP(method, url, headers, body) {
    let code = `<?php\n\n`;
    code += `$ch = curl_init();\n`;
    code += `curl_setopt($ch, CURLOPT_URL, '${url}');\n`;
    code += `curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);\n`;
    code += `curl_setopt($ch, CURLOPT_CUSTOMREQUEST, '${method}');\n`;
    
    if (Object.keys(headers).length > 0) {
      code += `curl_setopt($ch, CURLOPT_HTTPHEADER, [\n`;
      Object.entries(headers).forEach(([key, value]) => {
        code += `    '${key}: ${value}',\n`;
      });
      code += `]);\n`;
    }
    
    if (body) {
      code += `curl_setopt($ch, CURLOPT_POSTFIELDS, ${body});\n`;
    }
    
    code += `$response = curl_exec($ch);\n`;
    code += `curl_close($ch);\n`;
    code += `echo $response;`;
    
    return code;
  }

  static generateGo(method, url, headers, body) {
    let code = `package main\n\n`;
    code += `import (\n`;
    code += `    "bytes"\n`;
    code += `    "fmt"\n`;
    code += `    "io/ioutil"\n`;
    code += `    "net/http"\n`;
    code += `)\n\n`;
    code += `func main() {\n`;
    code += `    client := &http.Client{}\n`;
    
    if (body) {
      code += `    var jsonStr = []byte(${body})\n`;
      code += `    req, err := http.NewRequest("${method}", "${url}", bytes.NewBuffer(jsonStr))\n`;
    } else {
      code += `    req, err := http.NewRequest("${method}", "${url}", nil)\n`;
    }
    
    code += `    if err != nil {\n`;
    code += `        fmt.Println(err)\n`;
    code += `        return\n`;
    code += `    }\n`;
    
    Object.entries(headers).forEach(([key, value]) => {
      code += `    req.Header.Set("${key}", "${value}")\n`;
    });
    
    code += `    resp, err := client.Do(req)\n`;
    code += `    if err != nil {\n`;
    code += `        fmt.Println(err)\n`;
    code += `        return\n`;
    code += `    }\n`;
    code += `    defer resp.Body.Close()\n`;
    code += `    body, _ := ioutil.ReadAll(resp.Body)\n`;
    code += `    fmt.Println(string(body))\n`;
    code += `}`;
    
    return code;
  }

  static generate(method, url, headers, body, language = 'javascript') {
    const generators = {
      javascript: this.generateJavaScript,
      python: this.generatePython,
      php: this.generatePHP,
      go: this.generateGo
    };

    const generator = generators[language];
    if (generator) {
      return generator(method, url, headers, body);
    }
    return 'Language not supported';
  }

  static getLanguages() {
    return ['javascript', 'python', 'php', 'go'];
  }

  static getLanguageLabel(lang) {
    const labels = {
      javascript: 'JavaScript (fetch)',
      python: 'Python (requests)',
      php: 'PHP (cURL)',
      go: 'Go (net/http)'
    };
    return labels[lang] || lang;
  }
}