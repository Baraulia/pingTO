# PingTo

Local API client for Chrome. Send HTTP from the browser, keep collections on this device, skip a desktop app.

**Install from the [Chrome Web Store](https://chromewebstore.google.com/)** (search **PingTo**). That is the supported way to run PingTo. Pro is a $29/year license (up to 3 devices) via Lemon Squeezy inside the store build.

## Free

- Unlimited tabs; GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD
- Query and path params, headers, cookies, docs
- Bodies: JSON, form, multipart, text
- Auth: Bearer, Basic, API Key
- Pretty JSON/XML, HTML preview, redirects, JSONPath
- cURL import and export
- 2 collections (25 saved requests), PingTo JSON import/export
- 1 environment (10 variables, `{{base_url}}` in URL, headers, and body)
- History (50 items), light/dark theme, English and Russian UI
- Requests go through the extension, so page CORS does not block them

## Pro — $29 / year, one license key on up to 3 devices

Checkout opens Lemon Squeezy. Card details never enter PingTo. Paste the license key and Activate. Remove license on a machine you no longer use.

- Unlimited collections, saved requests, environments; history up to 2000
- GraphQL (editor, variables, introspection)
- WebSocket and SSE
- Digest and OAuth 2.0
- Binary body, pre-request scripts, tests, snapshots, response diff
- Run collection
- Import/export Postman, Insomnia, Bruno; import OpenAPI
- Code snippets (JavaScript, Python, PHP, Go)
- Load testing via a local agent you download for your OS (not inside the extension)

Workspace data stays in `chrome.storage.local`. License activate/deactivate calls Lemon Squeezy. The load-test catalog and binaries come from GitHub Releases when you use that tab.

## Shortcuts

| Action | Windows / Linux | macOS |
|--------|-----------------|-------|
| Open PingTo | `Ctrl+Shift+A` | `Cmd+Shift+A` |
| Send | `Ctrl+Enter` | `Cmd+Enter` |
| Command palette | `Ctrl+K` | `Cmd+K` |

## License

[MIT](LICENSE)
