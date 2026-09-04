# PingTo

Local API client for Chrome. Send HTTP from the browser, keep collections on this device, skip a desktop app.

**Install from the [Chrome Web Store](https://chromewebstore.google.com/)** (search **PingTo**). That is the supported way to run PingTo. Pro is a $29/year license (up to 3 devices) via Lemon Squeezy: checkout opens in a tab, then you paste the license key. Card details never enter PingTo.

[Privacy](PRIVACY.md) · [Store listing copy](ToDelete/STORE-LISTING.md)

## Free

- Unlimited tabs; GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD
- Query and path params, headers, cookies, docs
- Bodies: JSON, form, multipart, text
- Auth: Bearer, Basic, API Key; Inherit from parent (nearest folder, then the collection — the collection cannot inherit)
- Response Body: Pretty (JSON tree, click a key to copy its path; XML), Raw, Preview (HTML and images)
- JSONPath, redirects
- cURL import; Copy as cURL substitutes the selected environment, otherwise keeps `{{placeholders}}`
- 2 collections (25 saved requests), PingTo JSON import/export (import is refused if it would exceed those caps)
- 1 environment (10 variables, `{{base_url}}` in URL, headers, body, and auth)
- History (50 items), light/dark theme, English and Russian UI
- Requests go through the extension, so page CORS does not block them

## Pro — $29 / year, one license key on up to 3 devices

- Unlimited collections, saved requests, environments; history up to 2000
- GraphQL editor, variables, schema introspection
- WebSocket and SSE
- Digest and OAuth 2.0
- Binary body; pre-request scripts and tests (JavaScript in an isolated sandbox on this device); snapshots; response diff
- Run a collection or a folder; optional JSON/CSV rows fill `{{variables}}` per iteration
- Workspace file: collections, environments, tabs and settings (activate the license on each device; optional passphrase)
- Postman v2, Insomnia, and Bruno `.bru` import/export; OpenAPI (paths and methods) and HAR import
- Code snippets (JavaScript, Python, PHP, Go) with the same environment substitution as cURL
- Load testing via a local agent you download for your OS (not inside the extension). Default listen address is `127.0.0.1:8788`; the agent has no login, so any program on this machine can call it while it is running.

License activate/deactivate calls Lemon Squeezy. The load-test catalog and binaries come from GitHub Releases when you use that tab. Workspace data stays in `chrome.storage.local`.

## Shortcuts

| Action | Windows / Linux | macOS |
|--------|-----------------|-------|
| Open PingTo | `Ctrl+Shift+A` | `Cmd+Shift+A` |
| Send | `Ctrl+Enter` or `Ctrl+Shift+Q` | `Cmd+Enter` or `Cmd+Shift+Q` |
| Command palette | `Ctrl+K` | `Cmd+K` |

`Ctrl+Shift+Q` is the Chrome command (works even when a field would swallow Enter). Palette is in-app only.

## License

[MIT](LICENSE)
