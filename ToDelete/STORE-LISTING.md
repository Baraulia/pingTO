# Chrome Web Store listing — PingTo

Paste into [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devhub) → **Store listing**.  
English is the default locale. Repeat **Summary** and **Detailed description** under locale **ru** (screenshots can stay EN for v1).

**Do not** keyword-stuff, name competitors, or claim “#1 / fastest / Editor’s Choice”.

| Dashboard field | Limit / spec | Required for publish |
|---|---|---|
| Item title | Short; matches manifest | Yes (from item / manifest) |
| Summary | ≤ 132 characters | Yes |
| Detailed description | ≤ 16 000 characters; overview + feature list; extra how-to is allowed | Yes |
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

**Summary** (132 characters including spaces):

```
Local API client in Chrome. REST, cURL, collections, env vars. Pro: GraphQL, WebSocket, load tests. Data stays on this device.
```

**Detailed description** (~5 200 characters; limit 16 000):

```
PingTo is a local API client that lives in Chrome. Open it with a shortcut, send a request, and keep working — no desktop app, no account, no cloud workspace.

Your collections, environments, history, and response bodies stay in chrome.storage on this computer. Card details never enter PingTo: Pro checkout opens Lemon Squeezy, then you paste a license key.

FREE
• Unlimited tabs and HTTP methods (GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD)
• Query and path params, headers, cookies, docs
• Bodies: JSON, form, multipart, text
• Auth: Bearer, Basic, API Key, and Inherit from parent (nearest folder, then the collection — the collection is the root and cannot inherit)
• Response Body: Pretty (collapsible JSON tree, click a key to copy its path; highlighted XML), Raw (line numbers and wrap), Preview (HTML and images)
• JSONPath filter, redirects
• cURL import; Copy as cURL uses real environment values when an environment is selected, otherwise keeps {{placeholders}}
• 2 collections (25 saved requests). PingTo JSON import/export; import is refused if it would exceed those caps
• 1 environment (10 variables, {{base_url}} in URL, headers, body, and auth)
• History (50 items), light/dark theme, English and Russian
• Sends from the extension, so you are not blocked by page CORS

PRO — $29 / year, one key on up to 3 devices
• Unlimited collections, saved requests, environments, and history (up to 2000)
• GraphQL editor, variables, schema introspection
• WebSocket and SSE
• Digest and OAuth 2.0
• Binary body; pre-request scripts and tests (JavaScript in an isolated sandbox on this device); snapshots; response diff
• Run a collection or a folder; optional JSON/CSV rows fill {{variables}} per iteration
• Workspace file: copy collections, environments, tabs and settings to another computer (license is activated on each device; optional passphrase)
• Import/export Postman Collection v2, Insomnia, and Bruno .bru files; import OpenAPI (paths and methods) and HAR
• Code snippets (JavaScript, Python, PHP, Go) with the same environment substitution as cURL
• Load testing via a small local agent you download for your OS (not bundled in the extension)

LOAD TESTING (Pro)
Chrome cannot open thousands of parallel connections. PingTo drives a small agent that runs on this computer and repeats the current HTTP request.

1. Open an HTTP request first (GET is enough to try it). WebSocket and SSE cannot be load-tested.
2. Open the Load test tab and download the agent for this OS (Windows .exe, or a binary for macOS / Linux). The file is not inside the extension; it is fetched from GitHub Releases when you click download. Do not run a copy from chat or an unknown site.
3. Start the agent. It listens only on this machine (127.0.0.1, default port 8788). On macOS/Linux you may need chmod +x first. Then click Check agent.
4. Choose how load grows:
   • Ramp: requests/sec climb from 0 to the target, then the test stops. Use this to find a breaking point.
   • Hold: short warmup, then keep the target rate. Use this when you need a full interval at peak — a ramp only touches the peak at the last moment.
5. Set target requests per second (0 = as fast as this PC can go). Optionally stop after N requests. Per-request timeout counts as a timeout in the report; it does not stop the whole run by itself.
6. Optional abort rules stop the test if error rate, p95 latency, or a streak of HTTP failures is too high. Checks start after a short grace period so a cold start does not abort immediately.
7. GET needs no extra data. For POST, PUT, PATCH, or DELETE, add ammo — a JSON array of shots — so each request is unique. {n} is the 1-based shot index for this run. After a successful write you can compensate (for example DELETE the created id). Compensation is not counted in RPS. Empty ammo means “send the current request as-is,” which collides on duplicate creates and leftover deletes.

The report shows live and peak req/s, latency percentiles, status codes, and whether the run finished or aborted. Copy report if you want the numbers elsewhere.

The agent has no telemetry and no login. By default it listens on 127.0.0.1:8788; any program on this computer can send it commands while it is running. Stop the agent when you are done. Only load APIs you own or have permission to test. A high target rate is what you ask for, not a promise that one PC will sustain it.

Open PingTo, paste a URL, hit Send. Upgrade only if you need GraphQL, live connections, imports from other clients, a workspace file, collection runs, or load tests.
```

---

## Product details — Russian (`ru`)

Same title in the dashboard is fine (`PingTo API Client`). If the locale allows a localized name, keep it short: `PingTo — API-клиент`.

**Summary** (≤ 132 characters):

```
Локальный API-клиент в Chrome. REST, cURL, коллекции, переменные. Pro: GraphQL, WebSocket, нагрузка. Данные на этом устройстве.
```

**Detailed description** (~5 400 characters; limit 16 000):

```
PingTo — локальный API-клиент в Chrome. Откройте по сочетанию клавиш, отправьте запрос и продолжайте работу: без десктопного приложения, без аккаунта и без облачного воркспейса.

Коллекции, окружения, история и тела ответов хранятся в chrome.storage на этом компьютере. Данные карты в PingTo не попадают: оплата Pro открывается на Lemon Squeezy, затем вы вставляете лицензионный ключ.

FREE
• Безлимит вкладок и HTTP-методы (GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD)
• Query и path-параметры, заголовки, cookies, docs
• Тела: JSON, form, multipart, text
• Авторизация: Bearer, Basic, API Key и «Наследовать от родителя» (ближайшая папка, затем коллекция; коллекция — корень, ей наследовать не от кого)
• Тело ответа: Pretty (сворачиваемое дерево JSON, клик по ключу копирует путь; подсветка XML), Raw (номера строк и перенос), Preview (HTML и картинки)
• Фильтр JSONPath, редиректы
• Импорт cURL; Copy as cURL подставляет значения окружения, если оно выбрано, иначе оставляет {{плейсхолдеры}}
• 2 коллекции (25 сохранённых запросов), импорт/экспорт PingTo JSON; импорт отклоняется, если файл выходит за эти лимиты
• 1 окружение (10 переменных, {{base_url}} в URL, заголовках, теле и auth)
• История (50 записей), светлая и тёмная тема, английский и русский
• Запрос уходит из расширения, поэтому CORS страницы вас не блокирует

PRO — $29 в год, один ключ на 3 устройства
• Безлимит коллекций, сохранённых запросов, окружений и истории (до 2000)
• Редактор GraphQL, переменные, интроспекция схемы
• WebSocket и SSE
• Digest и OAuth 2.0
• Бинарное тело; pre-request скрипты и тесты (JavaScript в изолированной песочнице на этом устройстве); снимки; diff ответа
• Прогон коллекции или папки; опционально JSON/CSV-строки подставляют {{переменные}} на каждой итерации
• Файл workspace: коллекции, окружения, вкладки и настройки на другой компьютер (лицензия активируется на каждом устройстве; пароль по желанию)
• Импорт/экспорт Postman Collection v2, Insomnia и Bruno .bru; импорт OpenAPI (пути и методы) и HAR
• Сниппеты кода (JavaScript, Python, PHP, Go) с той же подстановкой окружения, что и cURL
• Нагрузочный тест через небольшой локальный агент под вашу ОС (в расширение не входит)

НАГРУЗОЧНЫЙ ТЕСТ (Pro)
Chrome не откроет тысячи параллельных соединений. PingTo управляет небольшим агентом на этом компьютере: он многократно повторяет текущий HTTP-запрос.

1. Сначала откройте HTTP-запрос (достаточно GET). WebSocket и SSE нагружать нельзя.
2. Вкладка Load test → скачайте агент под эту ОС (Windows .exe или бинарник для macOS / Linux). Файл не лежит внутри расширения: он берётся из GitHub Releases по кнопке загрузки. Не запускайте копию из чата или с неизвестного сайта.
3. Запустите агент. Он слушает только эту машину (127.0.0.1, порт по умолчанию 8788). На macOS/Linux может понадобиться chmod +x. Затем нажмите Check agent.
4. Как растёт нагрузка:
   • Ramp: запросы/с поднимаются от 0 до цели, затем тест останавливается. Удобно искать точку поломки.
   • Hold: короткий разогрев, затем целевая скорость держится. Нужен, если важен полный интервал на пике — ramp касается цели только в конце.
5. Задайте целевые запросы в секунду (0 = насколько хватит этого ПК). Опционально остановить после N запросов. Таймаут одного запроса попадает в отчёт; сам прогон из-за него не останавливается.
6. Правила abort сами останавливают прогон, если доля ошибок, p95 или серия HTTP-сбоев слишком высоки. Проверки начинаются после короткой паузы, чтобы холодный старт не рвал тест сразу.
7. Для GET патроны не нужны. Для POST, PUT, PATCH и DELETE задайте ammo — JSON-массив выстрелов, чтобы каждый запрос был уникальным. {n} — номер выстрела в этом прогоне (с единицы). После успешной записи можно компенсировать (например DELETE созданного id). Компенсация в RPS не входит. Пустой ammo = «слать текущий запрос как есть»: повторные create и delete без уникальных id столкнутся.

В отчёте — текущие и пиковые req/s, перцентили задержки, коды статуса и то, завершился прогон или abort. Copy report копирует цифры.

У агента нет телеметрии и логина. По умолчанию он слушает 127.0.0.1:8788; любая программа на этом компьютере может слать ему команды, пока он запущен. Остановите агент, когда закончите. Нагружайте только свои API или те, на которые есть разрешение. Высокая целевая скорость — это запрос, а не обещание, что один ПК её выдержит.

Откройте PingTo, вставьте URL, нажмите Send. Pro нужен только для GraphQL, живых соединений, импорта из других клиентов, файла workspace, прогона коллекций или нагрузки.
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

1. REST — URL, Send, Pretty JSON tree. Caption: `Send HTTP without leaving Chrome`
2. Collections + `{{base_url}}`. Caption: `Local collections. Variables stay on this device`
3. Paste cURL → request. Caption: `Paste cURL. Send`
4. GraphQL (Pro). Caption: `GraphQL when you need it`
5. WebSocket **or** load-test chart. Caption: `WebSocket, SSE, and local load tests`

Capture the live extension. Do not generate a fake PingTo UI with an image model (misleading listing). Promo tiles may be designed in Figma / an image model, then overlay the real logo.

---

## Additional dashboard fields

- **Homepage:** https://github.com/Baraulia/pingTO
- **Support:** GitHub Issues on the same repo
- **Privacy policy:** required (`cookies`, `<all_urls>`, `identity`). Use `PRIVACY.md` in this repo (`https://github.com/Baraulia/pingTO/blob/main/PRIVACY.md`): request data stays on the device; license activate/deactivate calls Lemon Squeezy; the load-test agent and its manifest are downloaded from GitHub when the user uses that feature; Pro scripts run in a local sandbox.
- **Single purpose:** API client

---

## Zip for upload

Do not upload the git repo. From the repo root (PowerShell if `npm` is blocked: `npm.cmd run pack`):

```text
npm run pack
```

Produces `pingto-cws.zip` (extension files only). Fill `modules/billing-config.js` `checkoutUrl` before a store build users can pay for.
