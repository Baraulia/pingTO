# Chrome Web Store listing — PingTo

Paste into [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devhub) → **Store listing**.  
English is the default locale. Repeat **Summary** and **Detailed description** under locale **ru** (screenshots can stay EN for v1).

**Do not** keyword-stuff, name competitors, or claim “#1 / fastest / Editor’s Choice”.

| Dashboard field | Limit / spec | Required for publish |
|---|---|---|
| Item title | Short; matches manifest | Yes (from item / manifest) |
| Summary | ≤ 132 characters | Yes |
| Detailed description | Long text on the listing page | Yes |
| Category | Developer Tools (else Productivity) | Yes |
| Store icon | 128×128 PNG | Yes |
| Screenshots | 1280×800 (or 640×400), up to 5 | At least 1; use 5 |
| Small promo tile | 440×280 PNG/JPEG, no transparency, full bleed | Yes |
| Marquee | 1400×560 | No — homepage carousel only if Google features you |
| Promo video | YouTube URL (Public or Unlisted, not Private) | No |

Marquee is **not** the listing gallery. Search and the item page use the small tile + screenshots. Ship without marquee and without video.

Reference listings (text tone / API-client structure / screenshot rhythm; they have **no** video):  
[React Developer Tools](https://chromewebstore.google.com/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi),  
[Talend API Tester – Free Edition](https://chromewebstore.google.com/detail/talend-api-tester-free-ed/aejoelaoggembcahagimdiliamlcdmfm),  
[Octotree](https://chromewebstore.google.com/detail/octotree-github-code-tree).

---

## Product details — English

**Item title:** PingTo API Client

**Language:** English (default)

**Category:** Developer Tools

**Summary** (112 characters including spaces):

```
Local API client in Chrome. REST, cURL, collections. Pro: GraphQL, WebSocket, load tests. Data stays on your device.
```

**Detailed description:**

```
PingTo is a local API client that lives in Chrome. Open it with a shortcut, send a request, and keep working — no desktop app, no account, no cloud workspace.

Your collections, environments, history, and response bodies stay in chrome.storage on this computer. Card details never enter PingTo: Pro checkout opens Lemon Squeezy, then you paste a license key.

FREE
• Unlimited tabs and HTTP methods (GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD)
• Query and path params, headers, cookies, docs
• Bodies: JSON, form, multipart, text
• Auth: Bearer, Basic, API Key
• Pretty JSON/XML, HTML preview, redirects, JSONPath
• cURL import and export
• 2 collections (25 saved requests), PingTo JSON import/export
• 1 environment (10 variables, {{base_url}} in URL, headers, and body)
• History (50 items), light/dark theme, English and Russian
• Sends from the extension, so you are not blocked by page CORS

PRO — $29 / year, one key on up to 3 devices
• Unlimited collections, saved requests, environments, and history (up to 2000)
• GraphQL editor, variables, schema introspection
• WebSocket and SSE
• Digest and OAuth 2.0
• Binary body, pre-request scripts, tests, snapshots, response diff
• Run collection
• Import/export Postman, Insomnia, Bruno; import OpenAPI
• Code snippets (JavaScript, Python, PHP, Go)
• Load testing via a small local agent you download for your OS (not bundled in the extension)

Open PingTo, paste a URL, hit Send. Upgrade only if you need GraphQL, live connections, imports from other clients, or load tests.
```

---

## Product details — Russian (`ru`)

Same title in the dashboard is fine (`PingTo API Client`). If the locale allows a localized name, keep it short: `PingTo — API-клиент`.

**Summary** (≤ 132 characters):

```
Локальный API-клиент в Chrome. REST, cURL, коллекции. Pro: GraphQL, WebSocket, нагрузка. Данные остаются на устройстве.
```

**Detailed description:**

```
PingTo — локальный API-клиент в Chrome. Откройте по сочетанию клавиш, отправьте запрос и продолжайте работу: без десктопного приложения, без аккаунта и без облачного воркспейса.

Коллекции, окружения, история и тела ответов хранятся в chrome.storage на этом компьютере. Данные карты в PingTo не попадают: оплата Pro открывается на Lemon Squeezy, затем вы вставляете лицензионный ключ.

FREE
• Безлимит вкладок и HTTP-методы (GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD)
• Query и path-параметры, заголовки, cookies, docs
• Тела: JSON, form, multipart, text
• Авторизация: Bearer, Basic, API Key
• Pretty JSON/XML, HTML preview, редиректы, JSONPath
• Импорт и экспорт cURL
• 2 коллекции (25 сохранённых запросов), импорт/экспорт PingTo JSON
• 1 окружение (10 переменных, {{base_url}} в URL, заголовках и теле)
• История (50 записей), светлая и тёмная тема, английский и русский
• Запрос уходит из расширения, поэтому CORS страницы вас не блокирует

PRO — $29 в год, один ключ на 3 устройства
• Безлимит коллекций, сохранённых запросов, окружений и истории (до 2000)
• Редактор GraphQL, переменные, интроспекция схемы
• WebSocket и SSE
• Digest и OAuth 2.0
• Бинарное тело, pre-request скрипты, тесты, снимки, diff ответа
• Запуск коллекции
• Импорт/экспорт Postman, Insomnia, Bruno; импорт OpenAPI
• Сниппеты кода (JavaScript, Python, PHP, Go)
• Нагрузочный тест через небольшой локальный агент под вашу ОС (в расширение не входит)

Откройте PingTo, вставьте URL, нажмите Send. Pro нужен только для GraphQL, живых соединений, импорта из других клиентов или нагрузки.
```

---

## Graphic assets

| Asset | Size | Notes |
|---|---|---|
| Store icon | 128×128 | Use `icons/icon128.png` |
| Screenshots 1–5 | **1280×800** | Real UI, square corners, no padding |
| Small promo tile | **440×280** | Brand, not a tiny crop of the app window |
| Marquee | 1400×560 | Skip for v1 |
| Promo video | YouTube | Skip for v1 |

Small tile (440×280), little text, dark charcoal + teal, readable when shrunk:

```
PingTo
API client in Chrome
```

Marquee later, if ever featured:

```
Local API client. In the browser.
REST · GraphQL · WebSocket
```

### Screenshot shot list (1280×800, dark theme, one idea per frame)

1. REST — URL, Send, pretty JSON. Caption: `Send HTTP without leaving Chrome`
2. Collections + `{{base_url}}`. Caption: `Local collections. Variables stay on this device`
3. Paste cURL → request. Caption: `Paste cURL. Send`
4. GraphQL (Pro). Caption: `GraphQL when you need it`
5. WebSocket **or** load-test chart. Caption: `WebSocket, SSE, and local load tests`

Capture the live extension. Do not generate a fake PingTo UI with an image model (misleading listing). Promo tiles may be designed in Figma / an image model, then overlay the real logo.

---

## Additional dashboard fields

- **Homepage:** https://github.com/Baraulia/pingTO
- **Support:** GitHub Issues on the same repo
- **Privacy policy:** required (`cookies`, `<all_urls>`, `identity`). State clearly: request data stays on the device; license activate/deactivate calls Lemon Squeezy; the load-test agent and its manifest are downloaded from GitHub when the user uses that feature.
- **Single purpose:** API client

---

## Zip for upload

Do not upload the git repo. From the repo root (PowerShell if `npm` is blocked: `npm.cmd run pack`):

```text
npm run pack
```

Produces `pingto-cws.zip` (extension files only). Fill `modules/billing-config.js` `checkoutUrl` before a store build users can pay for.
