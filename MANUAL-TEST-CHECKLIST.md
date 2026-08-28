# PingTo — чеклист ручного тестирования

Версия: `1.0.0`, UI `app.html`, unpacked Chrome MV3.  
Тумблер Pro в сайдбаре — **dev-заглушка** лицензии, не магазин.

**Локальный сервер (предпочтительно):** в каталоге `testd/` — `go run .` → `http://127.0.0.1:8787`.  
Импорт коллекции: `testd/pingto-testd-collection.json` (формат PingTo JSON, доступен на Free).  
Окружение: `base_url=http://127.0.0.1:8787`, `ws_url=ws://127.0.0.1:8787`. Учётки testd: `pingto` / `pingto`, Bearer `pingto-token`, `X-API-Key pingto-key`.

Запасные цели: `https://httpbin.org`, `https://jsonplaceholder.typicode.com`, `wss://echo.websocket.events`.

Отмечай `- [x]` по мере прохождения. Сначала **Free**, затем критичное на **Pro**.

### Тариф (ожидание)

| | Free | Pro |
|---|---|---|
| Вкладки | без лимита, Duplicate | то же |
| HTTP | GET…HEAD | + GraphQL, WS, SSE |
| Auth | none, Bearer, Basic, API Key | + Digest, OAuth 2.0 |
| Body | none, json, form, text, **multipart** | + binary, GraphQL JSON |
| Коллекции | 2 рабочих, 25 сохранённых запросов | без лимита |
| Сверх лимита коллекций | **не удаляются**, 🔒, открыть запрос → модалка Pro | все открыты |
| Env | 1 окружение, 10 переменных | без лимита |
| Import / Export | только PingTo JSON | + Postman, Insomnia, Bruno; OpenAPI **только import** |
| Run collection, Scripts, Snapshot, Diff, Tests, codegen | нет | да |
| Cookies, Docs, JSONPath, cURL | да | да |
| История | 50 | до 2000 |

---

- [x] **0. Установка и запуск**
  - [x] Расширение грузится unpacked без ошибок в `chrome://extensions`
  - [x] Иконки 16/48/128 на кнопке панели
  - [x] Клик по иконке открывает окно ~1280×860 (`popup`), не узкую side panel
  - [x] Повторный клик фокусирует уже открытое окно, не плодит второе
  - [x] Горячая клавиша Ctrl+Shift+A (Mac: Cmd+Shift+A) открывает то же окно
  - [x] После reload расширения окно открывается снова, service worker живой

- [ ] **1. Оболочка UI**
  - [ ] ☰ скрывает/показывает сайдбар
  - [ ] ⛶ разворачивает окно на весь экран; side panel закрывается, если была
  - [ ] Тема переключает light/dark, переживает reload
  - [ ] Кнопка языка: на EN написано **RU**, на RU — **EN**; клик реально меняет язык
  - [ ] После смены языка подписи, плейсхолдеры, toasts и подсказки Auth/Docs/Cookies/Code/WS на выбранном языке
  - [ ] Ctrl+K / палитра: поиск команд и запросов, Enter/клик выполняет, Esc закрывает
  - [ ] Палитра: Send, New tab, Format JSON, Environments, History, Settings, WebSocket
  - [ ] Запрос из 🔒-коллекции в палитре → модалка Pro
  - [ ] Узкое окно: url-бар и split не ломаются (stacked)

- [ ] **2. Free vs Pro (тумблер слева)**
  - [ ] По умолчанию Free: бейджи **PRO** на закрытых контролах
  - [ ] Клик по Pro-кнопке открывает модалку, действие не выполняется
  - [ ] Enable Pro (dev) и тумблер включают Pro, модалка закрывается
  - [ ] Выключение Pro **не режет вкладки** и **не удаляет** коллекции/env
  - [ ] Было >2 коллекций: тост + баннер `#freeQuotaHint`; первые 2 в списке рабочие, остальные 🔒
  - [ ] Auth Digest/OAuth и body binary/GraphQL на вкладках сбрасываются на Free-значения
  - [ ] История >50 обрезается до 50, в Settings hint про кап
  - [ ] На Free закрыты: WS/SSE, GraphQL, Scripts, Digest, OAuth, binary, Snapshot, Tests, Diff, codegen, чужие форматы import/export, Run collection
  - [ ] На Free открыты: HTTP GET…HEAD, params/headers, body none/json/form/text/multipart, auth none/bearer/basic/API Key, cookies, docs, JSONPath, cURL, PingTo JSON, 2 коллекции / 25 запросов, 1 env / 10 vars

- [ ] **3. Имя запроса и вкладки**
  - [ ] Поле имени слева от чипов вкладок, не в Docs
  - [ ] Ввод имени сразу меняет текст вкладки
  - [ ] Enter / blur: пустое имя → «New request» / «Новый запрос»
  - [ ] Двойной клик по имени на чипе ставит курсор в поле имени
  - [ ] Duplicate (footer) создаёт копию с суффиксом, **без** привязки к item коллекции; на Free тоже работает
  - [ ] Несколько вкладок на Free и Pro; переключение не теряет несохранённый ввод до Save
  - [ ] Закрытие последней вкладки невозможно
  - [ ] После reload вкладки и активная восстанавливаются

- [ ] **4. HTTP: URL, методы, Send**
  - [ ] GET/POST/PUT/PATCH/DELETE/OPTIONS/HEAD уходят корректным method (удобно: testd `/echo`)
  - [ ] Пустой URL → ошибка «введите URL»
  - [ ] Не-http(s) URL → invalid URL
  - [ ] Query из Params попадают в URL; чекбокс disable не отправляет пару (`/query`)
  - [ ] Path `:id` и `{id}` подставляются (`/users/:id`)
  - [ ] Common headers добавляют Accept и Content-Type, не дублируют существующие
  - [ ] Header enable/disable и удаление строки
  - [ ] Follow redirects on: цепочка во вкладке Redirects
  - [ ] Follow redirects off: виден 3xx без следования
  - [ ] Send → Cancel на долгом запросе (`/delay/8000`, ms), кнопка Send возвращается
  - [ ] Repeat повторяет последний запрос
  - [ ] Ctrl+Enter / Cmd+Enter и команда Ctrl+Shift+Q шлют запрос
  - [ ] Таймаут из Settings рвёт запрос (маленький timeout + delay)
  - [ ] Клик по status / time / size копирует значение

- [ ] **5. Body**
  - [ ] none: тело не уходит
  - [ ] json: валидный JSON + Content-Type json; битый JSON блокирует Send
  - [ ] Format / Minify меняют редактор; ошибка json под полем; на form/text кнопки неактивны
  - [ ] form: `a=1&b=2` как x-www-form-urlencoded (`/form`)
  - [ ] text: сырой текст (`/text`)
  - [ ] **Free multipart**: строки `key=value` + файлы (`/multipart`)
  - [ ] **Pro binary**: Choose file, файл уходит телом (`/binary`)
  - [ ] Free: binary и GraphQL JSON в селекте с «· PRO», выбор откатывается, модалка. **multipart без PRO**

- [ ] **6. Auth**
  - [ ] Подписи полей, подсказка по типу, лишние блоки скрыты
  - [ ] none: без Authorization
  - [ ] Bearer: `Authorization: Bearer …` (testd: `pingto-token`)
  - [ ] Basic: `Basic` + base64 user:pass (`pingto` / `pingto`)
  - [ ] API Key header и query — **Free** (`X-API-Key` / `pingto-key`)
  - [ ] Pro Digest: 401 challenge проходит (testd `/auth/digest`)
  - [ ] Pro OAuth2 client_credentials: token URL, client id/secret, scope → Bearer
  - [ ] Pro OAuth2 authorization_code + PKCE: Login / Get token открывает identity flow
  - [ ] Refresh token подтягивает новый access (если endpoint есть)
  - [ ] Free: digest и oauth2 недоступны; **API Key доступен**

- [ ] **7. Ответ**
  - [ ] Body: сырой текст
  - [ ] Pretty: JSON подсветка / XML pretty
  - [ ] Headers: список заголовков ответа
  - [ ] Preview: HTML в iframe sandbox (`/html`)
  - [ ] Redirects: шаги редиректов
  - [ ] Copy копирует body
  - [ ] Save качает файл `response_*.json`
  - [ ] Copy as cURL собирает текущий запрос
  - [ ] **JSONPath Free**: `$.…` фильтрует JSON
  - [ ] Pro Snapshot / Diff / Tests
  - [ ] Большой ответ не вешает UI (лимит ~2 МБ в background)

- [ ] **8. Переменные окружения**
  - [ ] Free: селект доступен; пункты **+ New environment** и **Manage environments…** внутри селекта (отдельной кнопки «+ Environment» нет)
  - [ ] Free: второе окружение → тост лимита (1 env)
  - [ ] Free: 11-я переменная → тост лимита (10 vars)
  - [ ] Create: имя обязательно; env с `base_url`; сразу выбрано в топбаре
  - [ ] + Variable, правка ключа/значения, secret маскирует value
  - [ ] × удаляет одну переменную, не всё окружение
  - [ ] Delete environment удаляет env и сбрасывает селект, если оно было активным
  - [ ] Hint под URL показывает активные `{{keys}}`
  - [ ] В URL/headers/body `{{base_url}}` подставляется при Send
  - [ ] Несуществующий `{{foo}}` остаётся как есть
  - [ ] Активное env переживает reload

- [ ] **9. Коллекции**
  - [ ] Пустое состояние: подсказка создать коллекцию
  - [ ] + Collection создаёт коллекцию (пустое имя → дефолт)
  - [ ] Free: 3-я новая коллекция → тост лимита, не создаётся
  - [ ] Free: 26-й **новый** сохранённый запрос → тост; обновление уже сохранённого не считается
  - [ ] После снятия Pro: лишние коллекции на месте, 🔒, баннер; клик по имени **раскрывает** дерево
  - [ ] Клик по запросу в 🔒-коллекции → модалка Pro, вкладка не открывается
  - [ ] Двойной клик → Rename / Delete; после удаления лишней следующая в списке разблокируется
  - [ ] Save в 🔒-коллекцию → тост + модалка Pro
  - [ ] Клик по коллекции: «Saving into: …»; у 🔒 — текст про лимит
  - [ ] После удаления коллекции вкладки отвязываются (не падают)
  - [ ] + Folder без выбранной коллекции → тост; в 🔒-коллекции → модалка Pro
  - [ ] + Folder создаёт папку в выбранной коллекции / во вложенной папке
  - [ ] Клик по папке: Save пишет **в эту папку**
  - [ ] Save у вкладок и Save request в сайдбаре — одно и то же
  - [ ] Save обновляет дерево сразу, без второй копии
  - [ ] Повторный клик по тому же запросу активирует существующую вкладку
  - [ ] Drag внутри своей коллекции; на 🔒-коллекцию drop → модалка; в другую коллекцию не переносится
  - [ ] Поиск в сайдбаре фильтрует по имени/URL
  - [ ] **Run collection** — кнопка в сайдбаре, **Pro**; на 🔒-коллекции → модалка
  - [ ] Меню **Import / Export** в сайдбаре (не футер)
  - [ ] Free: PingTo JSON import и export (выбранная коллекция или все, если ничего не выбрано)
  - [ ] Импорт PingTo **может** добавить коллекции сверх 2 — лишние сразу 🔒, данные не режутся
  - [ ] Pro import: Postman v2, Insomnia, OpenAPI/Swagger JSON, Bruno `.bru` / `.bru.txt`
  - [ ] Pro export: Postman, Insomnia, Bruno (файл `.bru.txt`)
  - [ ] Free: пункты Postman/Insomnia/Bruno/OpenAPI → модалка Pro
  - [ ] Мусорный файл → понятная ошибка формата

- [ ] **10. История**
  - [ ] После Send: метод, URL, дата и время
  - [ ] Клик по записи открывает запрос
  - [ ] Поиск и Clear
  - [ ] Free: список не растёт бесконечно (кап 50)
  - [ ] Settings: Pro до 2000, Free capped 50 + hint
  - [ ] Смена языка перерисовывает timestamp
  - [ ] История переживает reload

- [ ] **11. Code / cURL**
  - [ ] Подсказка: cURL vs сниппеты кода
  - [ ] Paste cURL → Import заполняет запрос
  - [ ] Copy cURL / Export cURL — валидная строка
  - [ ] Pro: Generate code / смена языка / Copy code
  - [ ] Free: блок codegen с PRO, без генерации; cURL остаётся

- [ ] **11b. Нагрузочный тест (Pro, локальный агент)**
  - [ ] Free: вкладка «Нагрузочный тест» → модалка Pro
  - [ ] Скачать агент: кнопка под эту ОС, SHA-256 / «каталог ещё не опубликован», другие ОС в details
  - [ ] Локальный бинарник запущен, Pro: Проверить агент → online (+ версия)
  - [ ] Профиль «Разгон 0 → пик»: testd `/health`, пик 10, 3000 ms → клиенты растут, на пике статус done
  - [ ] Профиль «Выйти и держать»: разогрев 1000 + hold 3000 → фаза hold, затем done
  - [ ] Живой дашборд: KPI (средний / макс / сейчас RPS), графики, полоса ok/fail/timeout, коды HTTP
  - [ ] Скачать отчёт → HTML с теми же графиками (SVG)
  - [ ] Патроны POST ` /v1/users` с `"id":"{n}"` + compensate DELETE `/v1/users/{n}`: без патронов — 409; со — GET `/v1/stats` users ≈ 1
  - [ ] Патроны DELETE `/v1/sessions/s-alpha|beta|gamma` + POST restore: без компенсации второй круг 404
  - [ ] count > 0 завершает прогон по числу запросов
  - [ ] WS/SSE и multipart/binary → тост что агент это не шлёт

- [ ] **12. GraphQL (Pro)**
  - [ ] Вкладка GraphQL: query + variables → Execute шлёт POST JSON
  - [ ] Introspect schema заполняет типы (testd `POST /graphql`)
  - [ ] Suggest не падает без схемы
  - [ ] Body type GraphQL JSON недоступен на Free

- [ ] **13. WebSocket / SSE (Pro)**
  - [ ] Подсказка: WS двусторонний, SSE односторонний HTTP-поток
  - [ ] Кнопка WS, метод WS/SSE и палитра открывают клиент **в том же окне**
  - [ ] Если уже SSE, палитра/WS не сбрасывают метод на WS
  - [ ] WS: Connect к `ws://127.0.0.1:8787/ws/echo` (или public echo), Send, лог, Disconnect
  - [ ] Reconnect после обрыва (если сервер рвёт)
  - [ ] `{{var}}` в URL сокета из env
  - [ ] SSE: метод SSE, URL `http://127.0.0.1:8787/sse`, Connect; Send и поле сообщения скрыты
  - [ ] Невалидный URL: ошибка в логе, UI не падает
  - [ ] Смена вкладки/метода закрывает сокет
  - [ ] Free: WS/SSE → модалка Pro

- [ ] **14. Scripts и тесты (Pro)**
  - [ ] Pre-request меняет env/запрос до отправки (`pm.environment.set`)
  - [ ] Ошибка pre-request → тост, запрос не уходит
  - [ ] Tests после ответа: pass/fail во вкладке Tests
  - [ ] Run collection учитывает упавшие тесты и Stop on fail

- [ ] **15. Cookies (Free)**
  - [ ] Подсказка: cookies Chrome по URL запроса, не storage PingTo
  - [ ] Load cookies for URL показывает cookies домена
  - [ ] Set появляется в списке после Load
  - [ ] Невалидный URL не роняет страницу

- [ ] **16. Docs (Free)**
  - [ ] Подсказка: заметки не уходят на сервер
  - [ ] Markdown сохраняется с запросом при Save в коллекцию
  - [ ] Имя запроса правится только в поле у вкладок

- [ ] **17. Settings**
  - [ ] Timeout сохраняется и используется
  - [ ] History max с учётом тарифа
  - [ ] SSL hint: invalid TLS из расширения не обойти
  - [ ] Close / Esc закрывают модалку без Save
  - [ ] Save закрывает модалку

- [ ] **18. Персистентность и изоляция**
  - [ ] Reload: вкладки, Pro-флаг, язык, тема, env, коллекции, история
  - [ ] Закрыть окно PingTo и открыть снова — то же состояние
  - [ ] Данные только в `chrome.storage`, без бэкенда PingTo
  - [ ] Два профиля Chrome не шарят коллекции

- [ ] **19. Ошибки и края**
  - [ ] 4xx/5xx: статус красный, body виден (testd `/status/404`)
  - [ ] CORS не ломает запросы из service worker
  - [ ] HTTPS с битым сертификатом: ошибка, без обхода
  - [ ] Отмена на уже завершённом запросе безопасна
  - [ ] Длинный URL / много хедеров не ломают вёрстку
  - [ ] Модалки Pro, Env, Settings, History, Run, Palette — Esc закрывает

- [ ] **20. Регрессии, которые уже ломались**
  - [ ] Язык: кнопка = язык, **на который** переключишься
  - [ ] Селект env не растягивает топбар; «+» вкладки на месте
  - [ ] Save сразу обновляет дерево; Save в папку, не только в корень
  - [ ] DnD запрос ↔ папка
  - [ ] История с timestamp
  - [ ] Повторное открытие запроса из коллекции не плодит вкладки
  - [ ] WS не в новой вкладке браузера
  - [ ] Env: удаление переменной vs удаление окружения
  - [ ] Имя запроса не вечное «New request»
  - [ ] Pro → Free не удаляет коллекции
  - [ ] Auth не выглядит как куча неподписанных полей

---

## Минимальный прогон (если мало времени)

1. `go run .` в `testd/`. Free: Import PingTo JSON `testd/pingto-testd-collection.json`.
2. Env `base_url` + Send `{{base_url}}/health`. История с временем.
3. Auth Bearer / API Key на testd. Вкладка Auth: подписи и подсказка.
4. Cookies Load/Set, Docs заметка, Code: cURL copy. JSONPath по JSON-ответу.
5. Создать 3-ю коллекцию на Free — отказ. Включить Pro, создать 3+, выключить Pro — 🔒, данные на месте, открыть запрос из 3-й → модалка.
6. Pro: папка → Save → открыть снова (та же вкладка) → DnD. Run collection. WS `/ws/echo`. SSE `/sse`. GraphQL `/graphql`.
7. RU/EN. Reload расширения — всё на месте.
