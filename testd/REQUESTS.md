# testd — все запросы

База: `http://127.0.0.1:8787`  
Запуск: в каталоге `testd` выполнить `go run .`  
Окружение PingTo: `base_url` = `http://127.0.0.1:8787`

## Общее для всех HTTP-запросов

| Параметр | Где | Обязательно | Значение |
|---|---|---|---|
| `delay` | query | нет | доп. пауза в мс поверх базовой (~8 мс + джиттер + 2 мс CPU). Пример: `?delay=100` |
| `Access-Control-*` | ответ | — | CORS `*` на все методы. `OPTIONS` любого пути → **204**, без тела |

Не действует имитация работы (sleep/CPU): `/health`, `/delay/{ms}`, `/ws/echo`, `/sse`.

Тело запроса режется на ~2 МиБ (`/multipart` — 8 МиБ). `/bytes/{n}` максимум 3 МиБ.

---

## Учётки (для auth-эндпоинтов)

| Что | Значение |
|---|---|
| Basic / Digest username | `pingto` |
| Basic / Digest password | `pingto` |
| Digest realm | `pingto` |
| Bearer (статический) | `pingto-token` |
| API key | `pingto-key` |
| API key header | `X-API-Key` |
| API key query | `api_key` |
| OAuth client_id | `pingto` |
| OAuth client_secret | `pingto-secret` |

---

## 1. GET `/`

Каталог сервера: учётки и список маршрутов.

- Path / query / headers / body: не нужны
- Auth: нет
- Ответ: **200** JSON (`name`, `base_url`, `accounts`, `routes`)
- Иначе любой другой путь без хендлера: **404** `{ "error": "not found" }` (через этот же `/`, если path ≠ `/`)

---

## 2. GET `/health`

Проверка, что процесс жив. Без искусственной задержки.

- Параметры: нет
- Auth: нет
- Ответ: **200** `{ "ok": true, "ts": <unix_ms> }`

---

## 3. ANY `/echo`

Эхо метода, URL, query, заголовков и сырого тела. Методы: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS (OPTIONS отсекается middleware → 204).

- Path: нет
- Query: любые, вернутся в `query`
- Headers: любые, вернутся в `headers`
- Body: любой текст/JSON, лимит 2 МиБ; для GET можно пусто
- Auth: нет
- Ответ: **200** JSON `method`, `url`, `query`, `headers`, `body`, `bytes`

Пример PingTo: POST `{{base_url}}/echo?foo=1` body `hello`

---

## 4. GET `/users/{id}`

Path-параметр.

- Path: `id` — строка, например `42` → `/users/42`
- Query / headers / body: не нужны
- Auth: нет
- Ответ: **200** `{ "id", "name": "user-{id}", "email": "user-{id}@pingto.local" }`

В PingTo URL: `{{base_url}}/users/:id`, Path `id=42`

---

## 5. GET `/query`

Только query string.

- Query: любые ключи, например `a=1&b=2`
- Headers / body / auth: нет
- Ответ: **200** `{ "query": { "a": ["1"], "b": ["2"] } }`

---

## 6. GET `/headers`

Эхо входящих заголовков.

- Headers: любые (Accept, Authorization, X-Test, …)
- Query / body / auth: нет
- Ответ: **200** `{ "headers": { ... } }`

---

## 7. ANY `/json` (ожидается тело JSON)

Разбор JSON. На практике: POST / PUT / PATCH (GET с пустым телом → **400** invalid json).

- Headers: `Content-Type: application/json` (рекомендуется)
- Body (обязательно, валидный JSON), например:
  ```json
  { "name": "ada", "n": 1 }
  ```
- Query / auth: нет
- Успех: **200** `{ "method", "json": <разобранный объект> }`
- Битый JSON: **400** `{ "error": "invalid json", "detail": "..." }`

---

## 8. POST `/form`

`application/x-www-form-urlencoded`.

- Headers: `Content-Type: application/x-www-form-urlencoded`
- Body: `a=1&b=hello` (поля любые)
- Query / auth: нет
- Ответ: **200** `{ "form": { "a": ["1"], "b": ["hello"] } }`
- Ошибка разбора: **400**

В PingTo: Body type = x-www-form-urlencoded

---

## 9. POST `/multipart`

Поля и файлы.

- Headers: `Content-Type: multipart/form-data` (границу выставит клиент)
- Body: поля `key=value` (в PingTo строки multipart) и/или файлы (multiFiles)
- Лимит формы: 8 МиБ
- Auth: нет
- Ответ: **200** `{ "fields": {...}, "files": { "<имя поля>": [{ "filename", "size", "type" }] } }`
- Не multipart: **400**

---

## 10. ANY `/binary` (POST или PUT)

Сырое бинарное тело.

- Headers: `Content-Type` любой, например `application/octet-stream` (вернётся в ответе)
- Body: файл / байты, лимит 2 МиБ
- Ответ: **200** `{ "bytes": <длина>, "content_type": "<из запроса>" }`

В PingTo: Body type = Binary file

---

## 11. GET `/text`

- Параметры не нужны
- Ответ: **200** `text/plain` — две строки `pingto text body` / `line 2`

---

## 12. GET `/html`

Для вкладки Preview.

- Параметры не нужны
- Ответ: **200** `text/html` — простая HTML-страница

---

## 13. GET `/xml`

Для Pretty XML.

- Параметры не нужны
- Ответ: **200** `application/xml` — `<root><item id="1">…`

---

## 14. GET `/status/{code}`

Фиксированный HTTP-статус.

- Path: `code` — целое 100…599, иначе сервер отдаёт **400**
- Примеры: `/status/200`, `/status/404`, `/status/500`, `/status/204`
- Query / headers / body: нет
- Тело ответа JSON: `{ "status": <code>, "ok": true|false }` (`ok` = 2xx)

---

## 15. GET `/delay/{ms}`

Сон, затем 200. Для Cancel и timeout в Settings. Без общей имитации работы.

- Path: `ms` — миллисекунды, clamp 0…60000. Пример: `/delay/10000`
- Если клиент отменил запрос — ответа не будет
- Ответ: **200** `{ "slept_ms": <n> }`

---

## 16. GET `/redirect/{n}`

Цепочка **302** на `n` прыжков, последний — 200.

- Path: `n` — число хопов. `/redirect/1` сразу 200. `/redirect/3` → 302 → `/redirect/2` → 302 → `/redirect/1` → 200
- В PingTo: Follow redirects вкл. — вкладка Redirects; выкл. — остаётесь на 302

---

## 17. POST `/redirect-keep`

**307** на `/echo`, метод и тело сохраняются.

- Headers: по желанию `Content-Type`
- Body: любое (уйдёт на `/echo` после редиректа)
- Ответ при follow: **200** от `/echo`

---

## 18. HEAD `/head`

- Только метод **HEAD** (GET даст 405)
- Headers / body: нет
- Ответ: **200**, тела нет, заголовок `X-PingTo: head`

---

## 19. GET `/cookies`

Список cookies, которые браузер/клиент уже послал на `127.0.0.1`.

- Headers: `Cookie` (ставится автоматически после Set)
- Query / body: нет
- Ответ: **200** `{ "cookies": [{ "name", "value" }] }`

В PingTo: вкладка Cookies → Load cookies for URL = `{{base_url}}/cookies`

---

## 20. POST `/cookies`

Ставит Set-Cookie.

Вариант A — query:

- Query: `name` (если пусто — имя `pingto`), `value` (если пусто вместе с именем из body — `ok`)
- Пример: `POST {{base_url}}/cookies?name=sid&value=abc`

Вариант B — JSON body (если `name` в query пустой):

- Headers: `Content-Type: application/json`
- Body: `{ "name": "sid", "value": "abc" }`

Если имя так и не задано: cookie `pingto=ok`.

- Ответ: **200** `{ "set", "value" }` + заголовок `Set-Cookie` (`Path=/`, не HttpOnly)
- Затем GET `/cookies` должен показать эту cookie (тот же origin)

---

## 21. GET `/auth/bearer`

- Headers (обязательно): `Authorization: Bearer pingto-token`  
  либо Bearer-токен, выданный `/oauth/token` (живёт 1 час)
- Query / body: нет
- Успех: **200** `{ "ok": true, "auth": "bearer" }`
- Иначе: **401** `{ "error": "invalid bearer" }`

В PingTo: Auth = Bearer, token = `pingto-token`

---

## 22. GET `/auth/basic`

- Headers: `Authorization: Basic …` (логин `pingto`, пароль `pingto`)
- Query / body: нет
- Успех: **200** `{ "ok": true, "auth": "basic", "user": "pingto" }`
- Иначе: **401** + `WWW-Authenticate: Basic realm="pingto"`

В PingTo: Auth = Basic

---

## 23. GET `/auth/digest`

Первый запрос без Digest → **401** + `WWW-Authenticate: Digest realm="pingto", qop="auth", nonce=…, opaque=…, algorithm=MD5`.  
Клиент (PingTo Digest) повторяет с заголовком Digest.

- Auth: username `pingto`, password `pingto`, realm `pingto`, qop `auth`, MD5
- Ручной заголовок не обязателен — расширение само считает `response`
- Успех: **200** `{ "ok": true, "auth": "digest" }`
- Неверный response: **401** `{ "error": "digest mismatch" }`

---

## 24. GET `/auth/apikey`

Нужен ключ **одним** из способов:

| Где | Имя | Значение |
|---|---|---|
| Header | `X-API-Key` | `pingto-key` |
| Query | `api_key` | `pingto-key` |

- Body: нет
- Успех: **200** `{ "ok": true, "auth": "apikey" }`
- Иначе: **401** `{ "error": "invalid api key" }`

В PingTo: Auth = API Key, name `X-API-Key`, in Header **или** Query `api_key`

---

## 25. GET `/oauth/authorize`

Старт authorization code + PKCE. Обычно дергает PingTo (Login / Get token), не руками.

Query (обязательные):

| Параметр | Значение |
|---|---|
| `response_type` | `code` (клиент ставит сам) |
| `client_id` | `pingto` |
| `redirect_uri` | URL редиректа Chrome Identity (`chrome.identity.getRedirectURL()`), без него **400** `missing redirect_uri` |
| `code_challenge` | S256 от verifier (PingTo ставит сам) |
| `code_challenge_method` | `S256` |
| `state` | опционально, вернётся в редиректе |
| `scope` | опционально, сервер не проверяет |

- Неверный `client_id`: **400** `invalid_client`
- Успех: **302** на `redirect_uri?code=…&state=…`  
  `code` живёт 10 минут, одноразовый

В PingTo OAuth2: grant Authorization code + PKCE  
Authorization URL = `{{base_url}}/oauth/authorize`  
Token URL = `{{base_url}}/oauth/token`  
Client ID `pingto`, secret `pingto-secret`

---

## 26. POST `/oauth/token`

Тело: `application/x-www-form-urlencoded` (или те же поля + Basic `pingto:pingto-secret`).

`client_id` обязателен и равен `pingto`.  
`client_secret`: если передан — только `pingto-secret`; пустой secret допускается.

### 26.1 `grant_type=client_credentials`

| Поле | Обязательно |
|---|---|
| `grant_type` | да, `client_credentials` |
| `client_id` | да, `pingto` (или Basic user) |
| `client_secret` | нет / `pingto-secret` |
| `scope` | нет, вернётся как есть |

Ответ **200**: `access_token`, `token_type: Bearer`, `expires_in: 3600`, `scope`

### 26.2 `grant_type=authorization_code`

| Поле | Обязательно |
|---|---|
| `grant_type` | `authorization_code` |
| `code` | код с `/oauth/authorize` |
| `client_id` | `pingto` |
| `redirect_uri` | тот же, что в authorize (клиент шлёт; сервер не сверяет строку) |
| `code_verifier` | исходный PKCE verifier; если на authorize был challenge — должен совпасть S256 |
| `client_secret` | опционально |

Ошибки: **400** `invalid_grant` / `invalid_pkce`  
Успех **200**: `access_token`, `refresh_token`, `expires_in: 3600`

### 26.3 `grant_type=refresh_token`

| Поле | Обязательно |
|---|---|
| `grant_type` | `refresh_token` |
| `refresh_token` | непустая строка (сервер не сверяет со выданным, только наличие) |
| `client_id` | `pingto` |

Успех **200**: новый `access_token`

Иной grant: **400** `unsupported_grant_type`  
Чужой client: **401** `invalid_client`

---

## 27. GET `/auth/oauth`

Ресурс после OAuth.

- Headers: `Authorization: Bearer <access_token>`  
  токен с `/oauth/token` **или** статический `pingto-token`
- Query / body: нет
- Успех: **200** `{ "ok": true, "auth": "oauth2" }`
- Иначе: **401** `{ "error": "invalid oauth token" }`

---

## 28. POST `/graphql`

- Headers: `Content-Type: application/json`
- Body (обязательно JSON):

```json
{
  "query": "<GraphQL>",
  "variables": { }
}
```

| query содержит | результат data |
|---|---|
| `__schema` или `IntrospectionQuery` | схема Query/User (для кнопки Introspect) |
| `users` и нет `user(` | `{ users: [{id,name}, …] }` |
| `user` | `{ user: { id, name } }`, `id` из `variables.id` или `"1"` |
| иначе (например `query { ping }` / `{ __typename }`) | `{ ping: "pong", __typename: "Query" }` |

Битый JSON: **200** с `errors: [{ message: "invalid json" }]` (как у GraphQL).

В PingTo: URL = `{{base_url}}/graphql`, вкладка GraphQL или body GraphQL JSON.

Примеры query:

```graphql
query { ping }
```

```graphql
query ($id: ID) { user(id: $id) { id name } }
```

variables: `{ "id": "7" }`

---

## 29. GET `/ws/echo`  (WebSocket)

Не HTTP JSON. В PingTo: метод **WS**, URL:

`ws://127.0.0.1:8787/ws/echo`

Браузер сам шлёт:

| Header | Значение |
|---|---|
| `Upgrade` | `websocket` |
| `Connection` | `Upgrade` |
| `Sec-WebSocket-Key` | генерирует клиент |
| `Sec-WebSocket-Version` | `13` |

- Query: нет (можно `delay` — не применяется, WS без simulateWork)
- Body HTTP: нет
- Если открыть как обычный GET без Upgrade: **426** `{ "error": "websocket upgrade required" }`
- После Connect: текстовые кадры эхом; ping → pong; close закрывает

---

## 30. GET `/sse`

Server-Sent Events. В PingTo: метод **SSE**, URL `{{base_url}}/sse` (http, не ws).

- Headers клиент ставит сам (`Accept: text/event-stream`)
- Query / body / auth: нет
- Ответ: **200** `text/event-stream`, 8 событий `data: {"n":…,"ts":…}` с паузой 400 мс, затем конец потока
- Send в PingTo для SSE недоступен (только приём)

---

## 31. GET `/bytes/{n}`

Поток байт `A` для проверки размера / truncation (~2 МиБ в расширении).

- Path: `n` — длина, 0…3145728 (3 МиБ). Больше — обрежется до 3 МиБ
- Пример: `/bytes/100`, `/bytes/3000000`
- Content-Type: `application/octet-stream`
- Query / auth: нет

---

## 32. GET `/slow-json`

JSON после стандартной имитации работы. Для вкладки Tests:

```
pm.test('ok', () => pm.expect(pm.response.code).toBe(200))
```

- Параметры не нужны
- Ответ: **200** `{ "ok": true, "code": 200, "message": "slow-json", "items": ["a","b","c"] }`

---

## OPTIONS (любой путь)

CORS preflight. Метод OPTIONS обрабатывается до хендлера.

- Headers запроса: браузер может слать `Origin`, `Access-Control-Request-Method`
- Ответ: **204** пустое тело, CORS-заголовки разрешают GET/POST/PUT/PATCH/DELETE/OPTIONS/HEAD и заголовки `Authorization, Content-Type, X-API-Key`

---

## Быстрый набор в PingTo (после env `base_url`)

1. GET `{{base_url}}/`  
2. GET `{{base_url}}/users/:id` path `id=1`  
3. POST `{{base_url}}/json` JSON `{"a":1}`  
4. POST `{{base_url}}/form`  
5. GET `{{base_url}}/delay/8000` + Cancel  
6. GET `{{base_url}}/redirect/3`  
7. GET `{{base_url}}/auth/bearer` Bearer `pingto-token`  
8. GET `{{base_url}}/auth/basic` pingto/pingto  
9. GET `{{base_url}}/auth/digest` pingto/pingto  
10. GET `{{base_url}}/auth/apikey` header `X-API-Key: pingto-key`  
11. POST `{{base_url}}/graphql` query `{ ping }`  
12. WS `ws://127.0.0.1:8787/ws/echo`  
13. SSE `{{base_url}}/sse`  
14. GET `{{base_url}}/html` → Preview  
15. GET `{{base_url}}/slow-json` → Tests  
