# PingTo — чеклист ручного тестирования

Версия UI: `app.html` / unpacked Chrome MV3.  
Тумблер Pro в сайдбаре — заглушка лицензии (не магазин).  
Удобные цели: `https://httpbin.org`, `https://jsonplaceholder.typicode.com`, `wss://echo.websocket.events`, любой GraphQL endpoint.

Отмечай `- [x]` по мере прохождения. Free-сценарии гоняй **до** включения Pro, затем повтори критичное на Pro.

---

- [ ] **0. Установка и запуск**
  - [ ] Расширение грузится unpacked без ошибок в `chrome://extensions`
  - [ ] Иконки 16/48/128 на кнопке панели
  - [ ] Клик по иконке открывает окно ~1280×860 (`popup`), не узкую side panel
  - [ ] Повторный клик фокусирует уже открытое окно, не плодит второе
  - [ ] Горячая клавиша Ctrl+Shift+A (Mac: Cmd+Shift+A) открывает то же окно
  - [ ] После reload расширения окно открывается снова, service worker живой

- [ ] **1. Оболочка UI**
  - [ ] ☰ скрывает/показывает сайдбар
  - [ ] ⛶ разворачивает окно на весь экран (fullscreen), side panel закрывается если была
  - [ ] Тема 🌙 переключает light/dark, переживает reload расширения
  - [ ] Кнопка языка: на EN-интерфейсе написано **RU**, на RU — **EN**; клик реально меняет язык, а не наоборот
  - [ ] После смены языка подписи, плейсхолдеры и тосты на выбранном языке
  - [ ] Ctrl+K / кнопка палитры: поиск команд и запросов, Enter/клик выполняет, Esc закрывает
  - [ ] Палитра: Send, New tab, Format JSON, Environments, Settings, WebSocket
  - [ ] Узкое окно: layout не ломает url-бар и split (stacked)

- [ ] **2. Free vs Pro (тумблер слева)**
  - [ ] По умолчанию Free: бейджи **PRO** на закрытых контролах
  - [ ] Клик по Pro-кнопке открывает модалку «функция Pro», не выполняет действие
  - [ ] Enable Pro (dev) и тумблер включают Pro, модалка закрывается
  - [ ] Выключение Pro сразу режет вкладки до 1, сбрасывает env/auth/body Pro-типов
  - [ ] На Free история > 50 в настройках не применяется, показывается hint
  - [ ] На Free одна вкладка «+» зовёт модалку extra tabs
  - [ ] Collections / Env / WS / GraphQL / Scripts / Cookies / Docs / OAuth / Digest / API Key / binary / multipart / snapshot / tests / diff / JSONPath / codegen / import-export / run / Bruno — закрыты на Free
  - [ ] На Free доступны: HTTP-методы (кроме WS/SSE), params/headers, body none/json/form/text, auth none/bearer/basic, ответ body/pretty/headers/preview/redirects, cURL import/export, тема, язык, история до 50

- [ ] **3. Имя запроса и вкладки**
  - [ ] Поле имени слева от вкладок, не «зарыто» в Docs
  - [ ] Ввод имени сразу меняет текст вкладки
  - [ ] Enter / blur сохраняет имя (пустое → дефолт «New request» / «Новый запрос»)
  - [ ] Двойной клик по имени на чипе ставит курсор в поле имени
  - [ ] Duplicate (Pro) создаёт копию с суффиксом, не привязанную к тому же item коллекции
  - [ ] Pro: несколько вкладок, переключение не теряет несохранённый ввод до Save (workspace persist)
  - [ ] Закрытие последней вкладки невозможно
  - [ ] После reload расширения вкладки и активная восстанавливаются

- [ ] **4. HTTP: URL, методы, Send**
  - [ ] GET/POST/PUT/PATCH/DELETE/OPTIONS/HEAD уходят корректным method
  - [ ] Пустой URL → ошибка «введите URL»
  - [ ] Не-http(s) URL → invalid URL
  - [ ] Query-параметры из вкладки Params попадают в URL; чекбокс disable не отправляет пару
  - [ ] Path `:id` и `{id}` подставляются из Path params
  - [ ] Common headers добавляют Accept и Content-Type, не дублируют существующие
  - [ ] Header enable/disable и удаление строки
  - [ ] Follow redirects on: цепочка видна во вкладке Redirects
  - [ ] Follow redirects off: виден 3xx без автоматического следования (если API отдаёт Location)
  - [ ] Send → Cancel на долгом запросе (задержка httpbin `/delay/10`), кнопка Send возвращается
  - [ ] Repeat повторяет последний запрос
  - [ ] Ctrl+Enter / Cmd+Enter и команда Ctrl+Shift+Q шлют запрос
  - [ ] Таймаут из Settings реально рвёт запрос (маленький timeout + delay)
  - [ ] Клик по status / time / size копирует значение

- [ ] **5. Body**
  - [ ] none: тело не уходит
  - [ ] json: валидный JSON уходит с Content-Type json; битый JSON блокирует Send
  - [ ] Format / Minify меняют редактор; ошибка json показывается под полем
  - [ ] form: `a=1&b=2` как x-www-form-urlencoded
  - [ ] text: сырой текст
  - [ ] Pro multipart: строки key=value + файлы multiFiles
  - [ ] Pro binary: Choose file, файл уходит телом
  - [ ] Free: binary/multipart/graphql в селекте с «· PRO», выбор откатывается и модалка

- [ ] **6. Auth**
  - [ ] none: без Authorization
  - [ ] Bearer: заголовок `Bearer <token>`
  - [ ] Basic: `Basic` + base64 user:pass
  - [ ] Pro Digest: 401 Digest challenge проходит (если есть тестовый сервер)
  - [ ] Pro API Key: in header и in query
  - [ ] Pro OAuth2 client_credentials: token URL, client id/secret, scope → Authorization Bearer
  - [ ] Pro OAuth2 authorization_code + PKCE: Login / Get token открывает identity flow
  - [ ] Refresh token подтягивает новый access (если endpoint есть)
  - [ ] Free: digest/apikey/oauth2 недоступны

- [ ] **7. Ответ**
  - [ ] Body: сырой текст
  - [ ] Pretty: JSON подсветка / XML pretty
  - [ ] Headers: список заголовков ответа
  - [ ] Preview: HTML в iframe sandbox
  - [ ] Redirects: шаги редиректов
  - [ ] Copy копирует body
  - [ ] Save качает файл response_*.json
  - [ ] Copy as cURL собирает текущий запрос
  - [ ] Pro Snapshot: снимок тела
  - [ ] Pro Diff: сравнение с snapshot
  - [ ] Pro Tests: результаты post-response тестов
  - [ ] Pro JSONPath: `$.…` фильтрует JSON
  - [ ] Большой ответ не вешает UI (лимит ~2 МБ в background)

- [ ] **8. Переменные окружения (Pro)**
  - [ ] Free: селект и «+ Environment» → модалка Pro
  - [ ] Create: имя обязательно; создаётся env с `base_url`
  - [ ] Новое env сразу выбрано в топбаре
  - [ ] + Variable, правка ключа/значения, secret маскирует value
  - [ ] × удаляет одну переменную, не всё окружение
  - [ ] Delete environment удаляет env целиком и сбрасывает селект, если оно было активным
  - [ ] Селект сверху переключает активное окружение, hint под URL показывает `{{keys}}`
  - [ ] В URL/headers/body `{{base_url}}` подставляется при Send
  - [ ] Несуществующий `{{foo}}` остаётся как есть
  - [ ] Активное env переживает reload

- [ ] **9. Коллекции (Pro)**
  - [ ] Пустое состояние: подсказка создать коллекцию
  - [ ] Имя + Collection создаёт коллекцию (пустое имя → дефолт)
  - [ ] Клик по имени коллекции выделяет её; строка «Сохранение в: …»
  - [ ] Двойной клик по коллекции: Rename / Delete, confirm на удаление
  - [ ] После удаления коллекции вкладки отвязываются (не падают)
  - [ ] + Folder без выбранной коллекции → тост «сначала выберите»
  - [ ] + Folder создаёт папку в выбранной коллекции / вложенно в выбранную папку
  - [ ] Двойной клик по папке: rename/delete папки
  - [ ] Клик по папке: Save пишет **в эту папку**
  - [ ] Save (у вкладок) и Save to collection в сайдбаре делают одно и то же
  - [ ] Save обновляет имя/метод/URL/params/headers/body в дереве сразу, без второй копии
  - [ ] Повторный клик по тому же запросу в дереве не открывает новую вкладку, а активирует существующую
  - [ ] Drag запроса на другую папку той же коллекции переносит его
  - [ ] Drag запроса на имя коллекции кладёт в корень
  - [ ] Drag в другую коллекцию не срабатывает (только внутри своей)
  - [ ] Поиск в сайдбаре фильтрует запросы по имени/URL
  - [ ] Run collection: прогон запросов, Stop on fail, отчёт pass/fail
  - [ ] Export: JSON PingTo выбранной коллекции (или всех, если ничего не выбрано)
  - [ ] Import того же JSON возвращает коллекцию
  - [ ] Import Postman Collection v2 JSON
  - [ ] Import Insomnia export (если есть фикстура)
  - [ ] Import OpenAPI/Swagger JSON
  - [ ] Import Bruno `.bru` / `.bru.txt`
  - [ ] Мусорный файл → понятная ошибка формата
  - [ ] Export Bruno качает `.bru.txt` выбранной коллекции
  - [ ] Free: дерево коллекций кликается в модалку Pro

- [ ] **10. История**
  - [ ] После Send появляется запись: метод, URL, **дата и время**
  - [ ] Клик по записи открывает запрос в редакторе
  - [ ] На Free список не растёт бесконечно (кап 50)
  - [ ] Settings history limit на Pro до 2000, на Free capped 50 + hint
  - [ ] Смена языка перерисовывает формат timestamp
  - [ ] История переживает reload

- [ ] **11. Code / cURL (вкладка Code)**
  - [ ] Paste cURL → Import создаёт/заполняет запрос
  - [ ] Copy cURL / Export cURL копирует валидную строку
  - [ ] Pro codegen: смена языка генерирует код, Copy code копирует
  - [ ] Free: блок codegen с PRO, без генерации

- [ ] **12. GraphQL (Pro)**
  - [ ] Вкладка GraphQL: query + variables → Execute шлёт POST JSON
  - [ ] Introspect schema заполняет список типов (нужен живой endpoint)
  - [ ] Подсказки по вводу (suggest) не падают без схемы
  - [ ] Body type GraphQL JSON недоступен на Free

- [ ] **13. WebSocket / SSE (Pro)**
  - [ ] Кнопка WS, метод WS/SSE и палитра открывают клиент **в том же окне**, не вкладку Chrome
  - [ ] WS: Connect к echo, Send, сообщение в логе, Disconnect
  - [ ] Reconnect: после обрыва соединение поднимается снова (если сервер рвёт)
  - [ ] `{{var}}` в URL сокета подставляется из env
  - [ ] SSE: Connect к http(s) event stream, Send скрыт/запрещён (receive-only)
  - [ ] Невалидный URL: ошибка в логе, не падает UI
  - [ ] Переключение вкладки/метода закрывает сокет
  - [ ] Free: WS/SSE → модалка Pro

- [ ] **14. Scripts и тесты (Pro)**
  - [ ] Pre-request меняет env/запрос до отправки (как в песочнице `pm.environment.set`)
  - [ ] Ошибка pre-request показывает тост и не шлёт
  - [ ] Tests после ответа: pass/fail во вкладке Tests
  - [ ] Run collection учитывает упавшие тесты и Stop on fail

- [ ] **15. Cookies (Pro)**
  - [ ] Load cookies for URL показывает cookies домена (нужен host_permissions)
  - [ ] Set cookie появляется в списке после Load
  - [ ] Невалидный URL не роняет страницу

- [ ] **16. Docs (Pro)**
  - [ ] Заметки Markdown сохраняются с запросом (Save в коллекцию)
  - [ ] Имя запроса правится в поле у вкладок, в Docs только подсказка

- [ ] **17. Settings**
  - [ ] Timeout сохраняется и используется
  - [ ] History max сохраняется с учётом тарифа
  - [ ] SSL hint: нельзя обойти invalid TLS из расширения
  - [ ] Close / Esc закрывают модалку без сохранения, если не жали Save
  - [ ] Save закрывает модалку

- [ ] **18. Персистентность и изоляция**
  - [ ] Reload расширения: вкладки, Pro-флаг, язык, тема, env, коллекции, история на месте
  - [ ] Закрыть окно PingTo и открыть снова — то же состояние
  - [ ] Данные только локально (chrome.storage), не уходят на внешний бэкенд PingTo
  - [ ] Два профиля Chrome не шарят коллекции

- [ ] **19. Ошибки и края**
  - [ ] 4xx/5xx: статус красный, body виден
  - [ ] CORS не должен ломать запросы из service worker (в отличие от страницы)
  - [ ] HTTPS с битым сертификатом: ошибка, без обхода
  - [ ] Отмена на уже завершённом запросе безопасна
  - [ ] Очень длинный URL / много хедеров не ломают вёрстку
  - [ ] Модалки: Pro, Env, Settings, Run, Palette — Esc закрывает

- [ ] **20. Регрессии, которые уже ломались**
  - [ ] Язык: кнопка = язык, **на который** переключишься
  - [ ] Save сразу обновляет дерево коллекции
  - [ ] Сохранение в папку, не только в корень коллекции
  - [ ] DnD запрос ↔ папка
  - [ ] История с timestamp
  - [ ] Повторное открытие запроса из коллекции не плодит вкладки
  - [ ] WS не в новой вкладке браузера
  - [ ] Env: удаление переменной vs удаление окружения
  - [ ] Имя запроса не вечное «New request»



---



## Минимальный прогон (если мало времени)

1. Free: Send GET httpbin `/get`, история с временем, Pro-кнопка → модалка.
2. Включить Pro.
3. Env `base_url` + Send `{{base_url}}/get`.
4. Коллекция → папка → Save → открыть снова (та же вкладка) → изменить имя → Save → дерево обновилось.
5. DnD в другую папку.
6. WS echo.
7. RU/EN кнопка и подписи.
8. Reload расширения — всё на месте.

