# 🚀 PingTo

### Ultra-light, private and fast API client right in your browser

---

## 📖 Overview

**PingTo** is a powerful, lightweight API testing tool that lives directly in your browser. No need to switch between applications or open new tabs — test your APIs instantly with a single keyboard shortcut.

Built for developers who need **speed**, **privacy**, and **convenience**. All data stays locally on your device — no servers, no accounts, no tracking.

---

## ✨ Features

### Free Version

**Core Features:**
- ✅ **HTTP Methods:** GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD
- ✅ **Unlimited tabs**
- ✅ **Request Builder** with query, path params, headers, cookies, docs
- ✅ **Request Body:** JSON, form-urlencoded, multipart, text
- ✅ **Authentication:** Bearer, Basic, API Key
- ✅ **Response Viewer:** pretty JSON/XML, HTML preview, headers, redirects, JSONPath
- ✅ **History** with search (50 items)
- ✅ **Collections:** 2 collections, 25 saved requests; PingTo JSON import/export
- ✅ **Environments:** 1 environment, 10 variables (`{{base_url}}` in URL, headers, body)
- ✅ **cURL** import and export
- ✅ **Light and Dark Theme**
- ✅ **English and Russian**

### Privacy & Security
- 🔒 **100% Local** — All data stored in `chrome.storage.local`
- 🌐 **No Servers** — Zero data sent to external services
- 👤 **No Accounts** — No registration or login required
- 📡 **Offline First** — Works without internet connection
- 🚫 **No CORS Issues** — Bypasses CORS restrictions via background service worker

### Performance
- ⚡ **Instant Access** with keyboard shortcut
- 📦 **Lightweight** with minimal resource usage
- 📱 **Responsive** on all screen sizes
- 🔄 **Async Requests** with non-blocking operations

---

## 💎 Pro Version

### Advanced Features:
- ♾️ **Unlimited history**, collections, saved requests, environments
- 📂 **Import/export** Postman, Insomnia, Bruno; **import** OpenAPI
- 📊 **GraphQL** editor, variables, introspection
- 🔌 **WebSocket and SSE**
- 🔐 **Digest Auth and OAuth 2.0**
- 📎 **Binary request body**
- 🧪 **Pre-request scripts, tests, snapshots, response diff**
- ▶️ **Run collection**
- 💻 **Code generation** (JavaScript, Python, PHP, Go)
- 📈 **Load testing** via a local agent binary for your OS (`dist/loadtest/`)

### Pricing:
- **Monthly:** $5/month

---

## 🆚 Why PingTo?
| Feature | PingTo | Postman | Hoppscotch | Bruno |
|---------|--------|---------|------------|-------|
| Startup Time | ⚡ Instant | 🐌 Slow | ⚡ Fast | 🐌 Slow |
| Privacy | 🔒 100% local | ☁️ Cloud sync | 🌐 Proxy required | 🔒 Local |
| CORS Bypass | ✅ Full support | ⚠️ Limited | ⚠️ Proxy required | ✅ Native |
| Offline | ✅ Full support | ⚠️ Limited | ⚠️ Limited | ✅ Full support |
| Resource Usage | 📦 Lightweight (~50MB) | 🏋️ Heavy (~500MB) | 📦 Lightweight | 📦 Lightweight |
| Browser Extension | ✅ Yes | ❌ No | ❌ No | ❌ No |
| Instant Access | ✅ Yes | ❌ No | ❌ No | ❌ No |
| Price | 💰 Affordable Pro | 💰 Free tier limited | 💰 Free | 💰 Free/Paid |
| Open Source | ✅ Yes | ❌ No | ✅ Yes | ✅ Yes |

---

## 📥 Installation

### From Chrome Web Store (Recommended)
1. Visit [Chrome Web Store](https://chrome.google.com/webstore)
2. Search for **"PingTo"**
3. Click **"Add to Chrome"**
4. Done! 🎉
---

## 🎯 Usage

### Basic Workflow
1. **Open extension:** `Ctrl+Shift+A` (Mac: `Cmd+Shift+A`)
2. Select HTTP method (GET, POST, etc.)
3. Enter the URL
4. Add headers if needed
5. Add request body for POST/PUT/PATCH
6. Click **"Send"** or use `Ctrl+Enter` (Mac: `Cmd+Enter`)
7. View response with status, time, and body

### Advanced Features

#### Collections
- Free: 2 collections, 25 saved requests, PingTo JSON import/export
- Pro: unlimited collections, Postman/Insomnia/Bruno import and export, OpenAPI import, run collection

#### Environments
- Free: 1 environment, 10 variables
- Pro: unlimited environments
- Use `{{base_url}}` and `{{api_key}}` in URL, headers, and body

#### GraphQL (Pro)
- Query editor with syntax highlighting
- Variables support
- Execute queries directly

#### WebSocket (Pro)
- Connect to WebSocket servers
- Send and receive messages in real-time
- Message history with timestamps

#### Code Generation (Pro)
- Generate code snippets in JavaScript, Python, PHP, Go
- Copy code with one click

---

## ⌨️ Keyboard Shortcuts
| Action | Windows/Linux | macOS |
|--------|---------------|-------|
| Open Extension | `Ctrl+Shift+A` | `Cmd+Shift+A` |
| Send Request | `Ctrl+Enter` | `Cmd+Enter` |
| Switch Tabs | `Alt+1-5` | `Cmd+1-5` |
| Clear Input | `Ctrl+Shift+C` | `Cmd+Shift+C` |
| Focus URL | `Ctrl+L` | `Cmd+L` |
| Focus Search | `Ctrl+F` | `Cmd+F` |

---

## 🛠️ Technical Details

### Architecture
- **Chrome Extension Manifest V3**
- **Vanilla JavaScript** (ES modules)
- **chrome.storage.local** for data
- **Fetch API** via Service Worker
- **CSS Variables** for theming

### Technology Stack
| Component | Technology |
|-----------|------------|
| Extension | Chrome Extension Manifest V3 |
| Language | Vanilla JavaScript (ES modules) |
| Storage | chrome.storage.local |
| Requests | Fetch API (via Service Worker) |
| Styling | CSS Variables (theming) |
| Icons | Lucide SVG Icons |
| i18n | Chrome i18n API |

### Data Storage
All data is stored locally in `chrome.storage.local`:
- **History:** API requests with full details (50 items free, 2000 Pro)
- **Collections:** grouped requests (2 collections / 25 requests on Free; unlimited on Pro)
- **Environments:** variables (1 env / 10 vars on Free; unlimited on Pro)
- **Settings:** Theme, language, timeout, default headers

### Security Features
- 🛡️ No external servers — All processing happens locally
- 🛡️ No data collection — Zero telemetry or analytics
- 🛡️ No cloud sync — Data never leaves your device
- 🛡️ Open source — Fully auditable code
- 🛡️ Minimal permissions — Only what's needed

---

## 👨‍💻 Development

### Prerequisites
- Chrome / Chromium
- Go 1.22+ (local testd server)
- Node.js 20+ (autotests)

### testd
```bash
go run -C testd .
```
Base URL: `http://127.0.0.1:8787`. Catalog and credentials: `GET /`. Request list: `testd/REQUESTS.md`. Importable collection: `testd/pingto-testd-collection.json`.

### Load agent (Pro tab Load test)
The Chrome extension does **not** contain the native binary. Users download one file for their OS from a GitHub Release (catalog `latest.json` with SHA-256). The Load test tab detects the OS, shows the official link and hash, and checks `/health` version against the catalog.

Publish: `git tag v1.0.0 && git push --tags` → workflow `.github/workflows/loadtest-release.yml` uploads six binaries + `latest.json`. Then paste `https://github.com/<org>/<repo>/releases/latest/download/latest.json` into **Release catalog URL** in the extension.

Local build: `npm run build:loadtest` → `dist/loadtest/` (plus `latest.json` hashes). Agent: `http://127.0.0.1:8788`. Details: `dist/loadtest/README.md`.

### Automated tests
```bash
npm install
npx playwright install chromium
npm test
```

`npm test` runs three layers:

1. **`npm run test:unit`** — Vitest, no browser (URL/env, import, sandbox, curl, codegen, …).
2. **`npm run test:testd`** — Go tests for every testd handler (HTTP, auth, GraphQL, SSE, WebSocket).
3. **`npm run test:e2e`** — Playwright loads the unpacked MV3 extension, talks to testd, covers Free/Pro UI, import, HTTP, auth, GraphQL, WS/SSE, environments.

Playwright `globalSetup` starts testd (`go run` in `testd/`) and `globalTeardown` stops it. Headed Chrome: `npm run test:e2e:headed` or `PINGTO_E2E_HEADED=1`.

OAuth authorization-code + `chrome.identity` (browser login popup) is not in e2e; client-credentials and the testd authorize redirect are covered in Go tests and the Login button path.

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## ⭐ Support the Project

- ⭐ Star on GitHub
- 🐛 Report issues
- 💡 Suggest features
- 💰 Sponsor development
- 🚀 Upgrade to Pro

---

**Made with ❤️ by developers, for developers**
