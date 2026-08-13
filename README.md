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
- ✅ **Request Builder** with intuitive interface
- ✅ **Headers Management** with common headers presets
- ✅ **Request Body:** JSON, Form Data, Multipart, Text/Plain
- ✅ **Authentication:** Bearer Token, Basic Auth, Digest Auth, OAuth 2.0
- ✅ **Response Viewer** with pretty-printed JSON, XML, HTML preview
- ✅ **Response Metadata:** Status code, response time, size
- ✅ **History** with search and restore (50 items limit)
- ✅ **cURL** Import and Export
- ✅ **Light and Dark Theme**
- ✅ **English and Russian Language**

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
- ♾️ **Unlimited History**
- 📂 **Collections** with create, manage, import/export
- 🌍 **Environments** with variables and quick switching
- 📊 **GraphQL** with query editor and variables
- 🔌 **WebSocket** with real-time messaging client
- 💻 **Code Generation** in JavaScript, Python, PHP, Go
- 🔗 **Git Integration** with .bru files
- 📝 **Notion Integration** for sync
- 📋 **Request Templates**
- 📦 **Full Export/Import** of collections

### Pricing:
- **Monthly:** $5/month
- **Yearly:** $48/year (save 20%)

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

### Manual Installation (Developer Mode)

First, clone the repository and install dependencies:

git clone https://github.com/yourusername/pingto.git
cd pingto
npm install
npm run build

Then load the `dist` folder in Chrome via **Load unpacked**.

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

#### Collections (Pro)
- Create and organize requests by project
- Export and import collections as JSON
- Run saved requests with one click

#### Environments (Pro)
- Create multiple environments (Production, Staging, Development)
- Use variables like `{{base_url}}` and `{{api_key}}`
- Variables are automatically replaced in URL, headers, and body

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
- **History:** API requests with full details (50 items free, unlimited Pro)
- **Collections:** Grouped requests with metadata (Pro only)
- **Environments:** Variables for different contexts (Pro only)
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
- Chrome browser (version 88+)
- Node.js (for development tools)
- Basic JavaScript knowledge

### Setup

Clone the repository and install dependencies:

git clone https://github.com/yourusername/pingto.git
cd pingto
npm install
npm run watch   # Development with hot reload
npm run build   # Production build
npm run package # Create extension package

### Project Structure

pingto/
├── _locales/          # Translations (EN/RU)
├── modules/           # Core modules (storage, history, collections, etc.)
├── pages/             # WebSocket, Collections, Environments pages
├── icons/             # Extension icons
├── background.js      # Service Worker
├── popup.html         # Main UI
├── popup.css          # Styles
├── popup.js           # Main logic
└── manifest.json      # Extension config

---

## 🤝 Contributing

We welcome contributions! Here's how you can help:

### Reporting Issues
- Check existing issues first
- Use the issue template
- Include steps to reproduce
- Attach screenshots if possible

### Feature Requests
- Describe the feature clearly
- Explain why it's needed
- Provide use cases
- Be open to discussion

### Pull Requests
1. Fork the repository
2. Create a feature branch
3. Write clean, documented code
4. Add tests if applicable
5. Submit PR with description

### Code Guidelines
- Use ES modules
- Follow existing code style
- Add comments for complex logic
- Update documentation
- Test thoroughly

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Lucide Icons](https://lucide.dev) — Beautiful open-source icons
- [Chrome Extensions](https://developer.chrome.com/docs/extensions/) — Browser extension platform
- [Bruno API Client](https://www.usebruno.com) — Inspiration for Git-based collections

---

## 📞 Contact

- **Website:** [api-client-pro.dev](https://api-client-pro.dev)
- **Email:** [support@pingto.dev](mailto:support@pingto.dev)
- **Twitter:** [@pingto](https://twitter.com/pingto)
- **GitHub:** [github.com/yourusername/pingto](https://github.com/yourusername/pingto)
- **Discord:** [Join our Discord](https://discord.gg/yourinvite)

---

## ⭐ Support the Project

- ⭐ Star on GitHub
- 🐛 Report issues
- 💡 Suggest features
- 💰 Sponsor development
- 🚀 Upgrade to Pro

---

**Made with ❤️ by developers, for developers**