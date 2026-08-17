// popup.js - главный контроллер с поддержкой локализации

import { StorageManager } from './modules/storage.js';
import { HistoryManager } from './modules/history.js';
import { CurlParser } from './modules/curl-parser.js';
import { ThemeManager } from './modules/theme.js';
import { UIHelpers } from './modules/ui-helpers.js';
import { CollectionsManager } from './modules/collections.js';
import { EnvironmentsManager } from './modules/environments.js';
import { I18nManager } from './modules/i18n.js';
import { CodeGenerator } from './modules/code-generator.js'; // ⬅️ ДОБАВЛЕНО

// ====== Инициализация ======
const storage = new StorageManager();
const historyManager = new HistoryManager(storage);
const themeManager = new ThemeManager();
const collectionsManager = new CollectionsManager(storage);
const environmentsManager = new EnvironmentsManager(storage);

// ====== Состояние ======
const state = {
  currentTab: 'request',
  currentReqTab: 'headers',
  currentRespTab: 'body',
  headers: [{ key: 'Content-Type', value: 'application/json' }],
  bodyType: 'json',
  authType: 'none',
  isSending: false,
  historyLimit: 999999,
};

// ====== DOM References ======
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
  methodSelect: $('#methodSelect'),
  urlInput: $('#urlInput'),
  sendBtn: $('#sendBtn'),
  headersList: $('#headersList'),
  addHeaderBtn: $('#addHeaderBtn'),
  addCommonHeadersBtn: $('#addCommonHeadersBtn'),
  bodyType: $('#bodyType'),
  bodyEditor: $('#bodyEditor'),
  authType: $('#authType'),
  authToken: $('#authToken'),
  basicUser: $('#basicUser'),
  basicPass: $('#basicPass'),
  basicAuthFields: $('#basicAuthFields'),
  oauth2Fields: $('#oauth2Fields'),
  curlInput: $('#curlInput'),
  parseCurlBtn: $('#parseCurlBtn'),
  exportCurlBtn: $('#exportCurlBtn'),
  generateCodeBtn: $('#generateCodeBtn'),
  responseStatus: $('#responseStatus'),
  responseTime: $('#responseTime'),
  responseSize: $('#responseSize'),
  responseBody: $('#responseBody'),
  responseHeaders: $('#responseHeaders'),
  responsePreview: $('#responsePreview'),
  copyResponseBtn: $('#copyResponseBtn'),
  saveResponseBtn: $('#saveResponseBtn'),
  historyList: $('#historyList'),
  historySearch: $('#historySearch'),
  clearHistoryBtn: $('#clearHistoryBtn'),
  exportHistoryBtn: $('#exportHistoryBtn'),
  themeToggle: $('#themeToggle'),
  languageToggle: $('#languageToggle'),
  fullscreenBtn: $('#fullscreenBtn'),
  codeModal: $('#codeModal'),
  codeLanguage: $('#codeLanguage'),
  codeOutput: $('#codeOutput'),
  copyCodeBtn: $('#copyCodeBtn'),
  closeCodeModal: $('#closeCodeModal'),
  proToggle: $('#proToggle'),
  proStatus: $('#proStatus'),
  licenseBtn: $('#licenseBtn'),
  historyLimit: $('#historyLimit'),
  collectionsList: $('#collectionsList'),
  environmentsList: $('#environmentsList'),
  newCollectionBtn: $('#newCollectionBtn'),
  importCollectionBtn: $('#importCollectionBtn'),
  exportAllCollectionsBtn: $('#exportAllCollectionsBtn'),
  newEnvironmentBtn: $('#newEnvironmentBtn'),
  saveToCollectionBtn: $('#saveToCollectionBtn'),
  saveAsEnvBtn: $('#saveAsEnvBtn'),
  environmentSelect: $('#environmentSelect'),
  collectionSelect: $('#collectionSelect'),
  graphqlQuery: $('#graphqlQuery'),
  graphqlVariables: $('#graphqlVariables'),
  graphqlPlayBtn: $('#graphqlPlayBtn'),
  websocketBtn: $('#websocketBtn'),
  settingsBtn: $('#settingsBtn'),
};

// ====== Безопасная инициализация ======
function safeAddListener(element, event, handler) {
    if (element) {
        element.addEventListener(event, handler);
    } else {
        console.warn(`Element not found for event: ${event}`);
    }
}

// ====== Инициализация i18n ======
await I18nManager.init();

// ====== Обработчики переключения языка ======
safeAddListener(dom.languageToggle, 'click', async () => {
    await I18nManager.toggle();
    renderAllDynamic();
});

document.addEventListener('languageChanged', () => {
    renderAllDynamic();
});

// ====== Generate Code ======
safeAddListener(dom.generateCodeBtn, 'click', () => {
    const method = dom.methodSelect.value;
    const url = dom.urlInput.value;
    const headers = {};
    state.headers.forEach(h => {
        if (h.key.trim()) headers[h.key.trim()] = h.value.trim();
    });
    const body = dom.bodyEditor.value;

    if (dom.codeModal) {
        dom.codeModal.classList.add('active');
        generateCode(method, url, headers, body);
    }
});

function generateCode(method, url, headers, body) {
    if (!dom.codeLanguage || !dom.codeOutput) return;
    const language = dom.codeLanguage.value;
    const code = CodeGenerator.generate(method, url, headers, body, language);
    dom.codeOutput.textContent = code;
}

safeAddListener(dom.codeLanguage, 'change', () => {
    const method = dom.methodSelect.value;
    const url = dom.urlInput.value;
    const headers = {};
    state.headers.forEach(h => {
        if (h.key.trim()) headers[h.key.trim()] = h.value.trim();
    });
    const body = dom.bodyEditor.value;
    generateCode(method, url, headers, body);
});

safeAddListener(dom.copyCodeBtn, 'click', () => {
    if (!dom.codeOutput) return;
    const code = dom.codeOutput.textContent;
    navigator.clipboard.writeText(code);
    UIHelpers.showToast('Code copied to clipboard', 'success');
});

safeAddListener(dom.closeCodeModal, 'click', () => {
    if (dom.codeModal) dom.codeModal.classList.remove('active');
});

if (dom.codeModal) {
    dom.codeModal.addEventListener('click', (e) => {
        if (e.target === dom.codeModal) {
            dom.codeModal.classList.remove('active');
        }
    });
}

// ====== Pro Mode ======
let isPro = false;

if (dom.proToggle) {
    dom.proToggle.addEventListener('change', () => {
        isPro = dom.proToggle.checked;
        if (dom.proStatus) {
            dom.proStatus.textContent = isPro ? '✅ Pro' : '🆓 Free';
            dom.proStatus.style.color = isPro ? '#22C55E' : '#9CA3AF';
        }
        document.querySelectorAll('.pro-feature').forEach(el => {
            el.style.display = isPro ? 'block' : 'none';
            el.disabled = !isPro;
        });
        chrome.storage.local.set({ isPro });
        UIHelpers.showToast(isPro ? 'Pro features unlocked!' : 'Free mode', isPro ? 'success' : 'info');
    });

    chrome.storage.local.get(['isPro'], (result) => {
        isPro = result.isPro || false;
        dom.proToggle.checked = isPro;
        if (dom.proStatus) {
            dom.proStatus.textContent = isPro ? '✅ Pro' : '🆓 Free';
            dom.proStatus.style.color = isPro ? '#22C55E' : '#9CA3AF';
        }
        document.querySelectorAll('.pro-feature').forEach(el => {
            el.style.display = isPro ? 'block' : 'none';
            el.disabled = !isPro;
        });
    });
}

// ====== Theme ======
safeAddListener(dom.themeToggle, 'click', () => {
    themeManager.toggle();
    if (dom.themeToggle) {
        dom.themeToggle.textContent = themeManager.isDark() ? '☀️' : '🌙';
    }
});

(async function initTheme() {
    await themeManager.init();
    if (dom.themeToggle) {
        dom.themeToggle.textContent = themeManager.isDark() ? '☀️' : '🌙';
    }
})();

// ====== Остальные функции (без изменений) ======
function renderAllDynamic() {
    renderHeaders();
    renderHistory();
    renderCollections();
    renderEnvironments();
    updateEnvAndCollectionSelects();
}

// ====== Tab Navigation ======
function switchTab(tabId) {
    state.currentTab = tabId;
    $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
    $$('.tab-content').forEach(c => c.classList.toggle('active', c.id === `tab-${tabId}`));
}

function switchReqTab(tabId) {
    state.currentReqTab = tabId;
    $$('.req-tab').forEach(t => t.classList.toggle('active', t.dataset.reqtab === tabId));
    $$('.req-content').forEach(c => c.classList.toggle('active', c.id === `req-${tabId}`));
}

function switchRespTab(tabId) {
    state.currentRespTab = tabId;
    $$('.resp-tab').forEach(t => t.classList.toggle('active', t.dataset.resptab === tabId));
    $$('.resp-content').forEach(c => c.classList.toggle('active', c.id === `resp-${tabId}`));
}

// ====== Headers ======
function renderHeaders() {
    if (!dom.headersList) return;
    dom.headersList.innerHTML = state.headers.map((h, i) => `
        <div class="header-row" data-index="${i}">
            <input type="text" placeholder="Key" value="${h.key}" data-header-key="${i}">
            <input type="text" placeholder="Value" value="${h.value}" data-header-value="${i}">
            <button class="remove-header" data-index="${i}">×</button>
        </div>
    `).join('');

    dom.headersList.querySelectorAll('[data-header-key]').forEach(inp => {
        inp.addEventListener('input', (e) => {
            const idx = parseInt(e.target.dataset.headerKey);
            state.headers[idx].key = e.target.value;
        });
    });

    dom.headersList.querySelectorAll('[data-header-value]').forEach(inp => {
        inp.addEventListener('input', (e) => {
            const idx = parseInt(e.target.dataset.headerValue);
            state.headers[idx].value = e.target.value;
        });
    });

    dom.headersList.querySelectorAll('.remove-header').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.index);
            state.headers.splice(idx, 1);
            renderHeaders();
        });
    });
}

safeAddListener(dom.addHeaderBtn, 'click', () => {
    state.headers.push({ key: '', value: '' });
    renderHeaders();
});

safeAddListener(dom.addCommonHeadersBtn, 'click', () => {
    const commonHeaders = [
        { key: 'Content-Type', value: 'application/json' },
        { key: 'Accept', value: 'application/json' },
        { key: 'User-Agent', value: 'API-Client-Pro/2.0' },
    ];
    commonHeaders.forEach(h => {
        if (!state.headers.find(existing => existing.key === h.key)) {
            state.headers.push(h);
        }
    });
    renderHeaders();
    UIHelpers.showToast(I18nManager.t('commonHeadersBtn'), 'success');
});

// ====== Auth ======
safeAddListener(dom.authType, 'change', (e) => {
    state.authType = e.target.value;
    if (dom.authToken) dom.authToken.style.display = state.authType === 'bearer' ? 'block' : 'none';
    if (dom.basicAuthFields) dom.basicAuthFields.style.display = state.authType === 'basic' ? 'block' : 'none';
    if (dom.oauth2Fields) dom.oauth2Fields.style.display = state.authType === 'oauth2' ? 'block' : 'none';
});

// ====== Body ======
safeAddListener(dom.bodyType, 'change', (e) => {
    state.bodyType = e.target.value;
    if (dom.bodyEditor) dom.bodyEditor.style.display = state.bodyType === 'none' ? 'none' : 'block';
    if (dom.bodyEditor) {
        if (state.bodyType === 'json') dom.bodyEditor.placeholder = '{"key": "value"}';
        else if (state.bodyType === 'form') dom.bodyEditor.placeholder = 'key1=value1&key2=value2';
        else if (state.bodyType === 'text') dom.bodyEditor.placeholder = 'Plain text...';
        else if (state.bodyType === 'graphql') dom.bodyEditor.placeholder = '{"query": "...", "variables": {...}}';
    }
});

// ====== Send Request ======
safeAddListener(dom.sendBtn, 'click', sendRequest);
safeAddListener(dom.urlInput, 'keydown', (e) => {
    if (e.key === 'Enter') sendRequest();
});

async function sendRequest() {
    if (state.isSending) return;
    state.isSending = true;
    if (dom.sendBtn) {
        dom.sendBtn.textContent = I18nManager.t('sendingBtn');
        dom.sendBtn.disabled = true;
    }

    try {
        const method = dom.methodSelect.value;
        const url = dom.urlInput.value.trim();
        if (!url) {
            UIHelpers.showToast(I18nManager.t('enterUrl'), 'error');
            return;
        }

        const headers = {};
        state.headers.forEach(h => {
            if (h.key.trim()) headers[h.key.trim()] = h.value.trim();
        });

        if (state.authType === 'bearer' && dom.authToken.value) {
            headers['Authorization'] = `Bearer ${dom.authToken.value}`;
        } else if (state.authType === 'basic') {
            const user = dom.basicUser.value;
            const pass = dom.basicPass.value;
            if (user && pass) {
                headers['Authorization'] = `Basic ${btoa(`${user}:${pass}`)}`;
            }
        }

        let body = null;
        const bodyType = dom.bodyType.value;
        if (bodyType !== 'none') {
            const rawBody = dom.bodyEditor.value;
            if (bodyType === 'json') {
                try {
                    JSON.parse(rawBody);
                    body = rawBody;
                    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
                } catch {
                    UIHelpers.showToast(I18nManager.t('invalidJson'), 'error');
                    return;
                }
            } else if (bodyType === 'form') {
                body = rawBody;
                headers['Content-Type'] = headers['Content-Type'] || 'application/x-www-form-urlencoded';
            } else if (bodyType === 'graphql') {
                body = rawBody;
                headers['Content-Type'] = headers['Content-Type'] || 'application/json';
            } else {
                body = rawBody;
            }
        }

        const response = await chrome.runtime.sendMessage({
            type: 'sendRequest',
            data: { method, url, headers, body }
        });

        displayResponse(response);

        if (response && !response.error) {
            historyManager.add({
                method,
                url,
                headers: state.headers,
                body,
                bodyType,
                authType: state.authType,
                status: response.status,
                time: response.time,
                size: response.size,
                timestamp: Date.now()
            });
            renderHistory();
        }

        switchTab('response');

    } catch (error) {
        UIHelpers.showToast(`${I18nManager.t('networkError')}: ${error.message}`, 'error');
        if (dom.responseBody) dom.responseBody.textContent = `${I18nManager.t('responseError')}: ${error.message}`;
    } finally {
        state.isSending = false;
        if (dom.sendBtn) {
            dom.sendBtn.textContent = I18nManager.t('sendBtn');
            dom.sendBtn.disabled = false;
        }
    }
}

// ====== Display Response ======
function displayResponse(response) {
    if (!dom.responseStatus || !dom.responseBody) return;
    if (response.error) {
        dom.responseStatus.textContent = `❌ ${I18nManager.t('responseError')}: ${response.error}`;
        dom.responseBody.textContent = response.body || response.error;
        if (dom.responseTime) dom.responseTime.textContent = `${I18nManager.t('timeLabel')}: —`;
        if (dom.responseSize) dom.responseSize.textContent = `${I18nManager.t('sizeLabel')}: —`;
        return;
    }

    const statusColor = response.ok ? '#22C55E' : '#EF4444';
    dom.responseStatus.innerHTML = `${I18nManager.t('statusLabel')}: <span style="color:${statusColor};font-weight:600;">${response.status} ${response.statusText}</span>`;
    if (dom.responseTime) dom.responseTime.textContent = `${I18nManager.t('timeLabel')}: ${response.time}ms`;
    if (dom.responseSize) dom.responseSize.textContent = `${I18nManager.t('sizeLabel')}: ${(response.size / 1024).toFixed(2)} KB`;

    let bodyText = response.body;
    try {
        const parsed = JSON.parse(response.body);
        bodyText = JSON.stringify(parsed, null, 2);
    } catch {}

    dom.responseBody.textContent = bodyText;
    if (dom.responseHeaders) dom.responseHeaders.textContent = JSON.stringify(response.headers, null, 2);

    if (dom.responsePreview && response.headers['content-type']?.includes('text/html')) {
        dom.responsePreview.srcdoc = response.body;
        dom.responsePreview.style.display = 'block';
    } else if (dom.responsePreview) {
        dom.responsePreview.style.display = 'none';
    }

    switchRespTab('body');
}

// ====== Copy Response ======
safeAddListener(dom.copyResponseBtn, 'click', () => {
    if (!dom.responseBody) return;
    const text = dom.responseBody.textContent;
    navigator.clipboard.writeText(text);
    UIHelpers.showToast(I18nManager.t('copyResponseBtn'), 'success');
});

// ====== Save Response ======
safeAddListener(dom.saveResponseBtn, 'click', () => {
    if (!dom.responseBody) return;
    const text = dom.responseBody.textContent;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `response_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    UIHelpers.showToast(I18nManager.t('saveResponseBtn'), 'success');
});

// ====== History ======
function renderHistory() {
    if (!dom.historyList || !dom.historySearch) return;
    const search = dom.historySearch.value.toLowerCase();
    const items = historyManager.getItems(state.historyLimit);
    
    const filtered = items.filter(item => 
        item.url.toLowerCase().includes(search) || 
        item.method.toLowerCase().includes(search)
    );

    if (filtered.length === 0) {
        dom.historyList.innerHTML = `<div class="empty-state">${I18nManager.t('historyEmpty')}</div>`;
        return;
    }

    dom.historyList.innerHTML = filtered.map(item => `
        <div class="history-item" data-id="${item.id}">
            <span class="h-method">${item.method}</span>
            <span class="h-url">${item.url}</span>
            <span class="h-status ${item.status >= 200 && item.status < 300 ? 'success' : 'error'}">
                ${item.status}
            </span>
            <span class="h-time">${new Date(item.timestamp).toLocaleString()}</span>
        </div>
    `).join('');

    dom.historyList.querySelectorAll('.history-item').forEach(el => {
        el.addEventListener('click', () => {
            const id = parseInt(el.dataset.id);
            const item = historyManager.getById(id);
            if (item) {
                dom.methodSelect.value = item.method;
                dom.urlInput.value = item.url;
                if (item.headers) state.headers = item.headers;
                if (item.body) dom.bodyEditor.value = item.body;
                if (item.bodyType) dom.bodyType.value = item.bodyType;
                if (item.authType) dom.authType.value = item.authType;
                renderHeaders();
                UIHelpers.showToast(I18nManager.t('restoreRequest'), 'success');
                switchTab('request');
            }
        });
    });

    if (dom.historyLimit) dom.historyLimit.textContent = I18nManager.t('historyLimit');
}

safeAddListener(dom.historySearch, 'input', renderHistory);

safeAddListener(dom.clearHistoryBtn, 'click', () => {
    if (confirm(I18nManager.t('clearHistoryBtn'))) {
        historyManager.clear();
        renderHistory();
    }
});

safeAddListener(dom.exportHistoryBtn, 'click', () => {
    const items = historyManager.getItems();
    const json = JSON.stringify(items, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `history_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    UIHelpers.showToast(I18nManager.t('exportHistoryBtn'), 'success');
});

// ====== cURL ======
safeAddListener(dom.parseCurlBtn, 'click', () => {
    try {
        const curl = dom.curlInput.value;
        const parsed = CurlParser.parse(curl);
        dom.methodSelect.value = parsed.method;
        dom.urlInput.value = parsed.url;
        state.headers = parsed.headers || [];
        if (parsed.body) {
            dom.bodyEditor.value = parsed.body;
            dom.bodyType.value = 'json';
        }
        renderHeaders();
        UIHelpers.showToast(I18nManager.t('curlImported'), 'success');
        switchTab('request');
    } catch (error) {
        UIHelpers.showToast(`${I18nManager.t('curlImported')}: ${error.message}`, 'error');
    }
});

safeAddListener(dom.exportCurlBtn, 'click', () => {
    const method = dom.methodSelect.value;
    const url = dom.urlInput.value;
    let headers = '';
    state.headers.forEach(h => {
        if (h.key && h.value) headers += ` -H '${h.key}: ${h.value}'`;
    });
    let body = '';
    if (dom.bodyType.value !== 'none' && dom.bodyEditor.value) {
        body = ` -d '${dom.bodyEditor.value}'`;
    }
    const curl = `curl -X ${method} ${url}${headers}${body}`;
    navigator.clipboard.writeText(curl);
    UIHelpers.showToast(I18nManager.t('curlExport'), 'success');
});

// ====== Collections ======
async function renderCollections() {
    if (!dom.collectionsList) return;
    const collections = await collectionsManager.getAll();
    if (!collections || collections.length === 0) {
        dom.collectionsList.innerHTML = `<div class="empty-state">${I18nManager.t('collectionsEmpty')}</div>`;
        return;
    }

    dom.collectionsList.innerHTML = collections.map(coll => `
        <div class="collection-item" data-id="${coll.id}">
            <div class="coll-header">
                <span class="coll-name">📁 ${coll.name}</span>
                <div class="coll-actions">
                    <button class="btn-secondary small delete-collection" data-id="${coll.id}">🗑️</button>
                    <button class="btn-secondary small export-collection" data-id="${coll.id}">📤</button>
                </div>
            </div>
            ${coll.requests && coll.requests.length > 0 ? coll.requests.map(req => `
                <div class="coll-request" data-coll-id="${coll.id}" data-req-id="${req.id}">
                    <span><strong>${req.method}</strong> ${req.url}</span>
                    <button class="btn-secondary small run-request" data-coll-id="${coll.id}" data-req-id="${req.id}">▶</button>
                </div>
            `).join('') : '<div class="text-muted" style="font-size:12px;padding:4px 0;">No requests</div>'}
        </div>
    `).join('');

    dom.collectionsList.querySelectorAll('.delete-collection').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            if (confirm('Delete this collection?')) {
                await collectionsManager.delete(id);
                renderCollections();
                updateEnvAndCollectionSelects();
            }
        });
    });

    dom.collectionsList.querySelectorAll('.run-request').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const collId = parseInt(btn.dataset.collId);
            const reqId = parseInt(btn.dataset.reqId);
            const coll = await collectionsManager.getById(collId);
            if (coll) {
                const req = coll.requests.find(r => r.id === reqId);
                if (req) {
                    dom.methodSelect.value = req.method;
                    dom.urlInput.value = req.url;
                    if (req.headers) state.headers = req.headers;
                    if (req.body) dom.bodyEditor.value = req.body;
                    renderHeaders();
                    UIHelpers.showToast('Request loaded from collection', 'success');
                    switchTab('request');
                }
            }
        });
    });
}

safeAddListener(dom.newCollectionBtn, 'click', async () => {
    const name = prompt(I18nManager.t('newCollectionBtn'));
    if (name) {
        await collectionsManager.create(name);
        renderCollections();
        updateEnvAndCollectionSelects();
    }
});

safeAddListener(dom.importCollectionBtn, 'click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        const text = await file.text();
        const data = JSON.parse(text);
        await collectionsManager.import(data);
        renderCollections();
        updateEnvAndCollectionSelects();
        UIHelpers.showToast(I18nManager.t('importCollectionBtn'), 'success');
    };
    input.click();
});

safeAddListener(dom.exportAllCollectionsBtn, 'click', async () => {
    const data = await collectionsManager.exportAll();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `collections_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    UIHelpers.showToast(I18nManager.t('exportAllCollectionsBtn'), 'success');
});

// ====== Environments ======
async function renderEnvironments() {
    if (!dom.environmentsList) return;
    const environments = await environmentsManager.getAll();
    if (!environments || environments.length === 0) {
        dom.environmentsList.innerHTML = `<div class="empty-state">${I18nManager.t('environmentsEmpty')}</div>`;
        return;
    }

    dom.environmentsList.innerHTML = environments.map(env => `
        <div class="environment-item" data-id="${env.id}">
            <div class="env-header">
                <span class="env-name">🌍 ${env.name}</span>
                <div>
                    <button class="btn-secondary small delete-env" data-id="${env.id}">🗑️</button>
                    <button class="btn-secondary small activate-env" data-id="${env.id}">▶</button>
                </div>
            </div>
            ${env.variables ? Object.entries(env.variables).map(([key, value]) => `
                <div class="env-var">
                    <span class="var-key">{{${key}}}</span>
                    <span>${value}</span>
                </div>
            `).join('') : '<div class="text-muted" style="font-size:12px;">No variables</div>'}
        </div>
    `).join('');

    dom.environmentsList.querySelectorAll('.delete-env').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            if (confirm('Delete this environment?')) {
                await environmentsManager.delete(id);
                renderEnvironments();
                updateEnvAndCollectionSelects();
            }
        });
    });

    dom.environmentsList.querySelectorAll('.activate-env').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = parseInt(btn.dataset.id);
            const env = await environmentsManager.getById(id);
            if (env) {
                dom.environmentSelect.value = id;
                UIHelpers.showToast(`Environment "${env.name}" activated`, 'success');
                let url = dom.urlInput.value;
                Object.entries(env.variables || {}).forEach(([key, value]) => {
                    url = url.replace(new RegExp(`{{${key}}}`, 'g'), value);
                });
                dom.urlInput.value = url;
            }
        });
    });
}

safeAddListener(dom.newEnvironmentBtn, 'click', async () => {
    const name = prompt(I18nManager.t('newEnvironmentBtn'));
    if (name) {
        const variables = {};
        let addMore = true;
        while (addMore) {
            const key = prompt('Variable key (or cancel to finish):');
            if (!key) break;
            const value = prompt(`Value for ${key}:`);
            if (value !== null) {
                variables[key] = value;
            }
        }
        await environmentsManager.create(name, variables);
        renderEnvironments();
        updateEnvAndCollectionSelects();
    }
});

// ====== Update Selects ======
async function updateEnvAndCollectionSelects() {
    if (!dom.environmentSelect || !dom.collectionSelect) return;
    const envs = await environmentsManager.getAll();
    dom.environmentSelect.innerHTML = `<option value="">${I18nManager.t('noEnvironment')}</option>`;
    envs.forEach(env => {
        dom.environmentSelect.innerHTML += `<option value="${env.id}">${env.name}</option>`;
    });

    const colls = await collectionsManager.getAll();
    dom.collectionSelect.innerHTML = `<option value="">${I18nManager.t('noCollection')}</option>`;
    colls.forEach(coll => {
        dom.collectionSelect.innerHTML += `<option value="${coll.id}">${coll.name}</option>`;
    });
}

// ====== Save to Collection ======
safeAddListener(dom.saveToCollectionBtn, 'click', async () => {
    const collectionId = parseInt(dom.collectionSelect.value);
    if (!collectionId) {
        UIHelpers.showToast('Select a collection first', 'error');
        return;
    }

    const request = {
        id: Date.now(),
        method: dom.methodSelect.value,
        url: dom.urlInput.value,
        headers: state.headers,
        body: dom.bodyEditor.value,
        bodyType: dom.bodyType.value,
        authType: dom.authType.value,
    };

    await collectionsManager.addRequest(collectionId, request);
    UIHelpers.showToast(I18nManager.t('saveToCollectionBtn'), 'success');
    renderCollections();
});

// ====== Fullscreen ======
safeAddListener(dom.fullscreenBtn, 'click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
});

// ====== Pro / License ======
safeAddListener(dom.licenseBtn, 'click', () => {
    alert(I18nManager.t('proFeatures'));
});

// ====== Инициализация ======
async function init() {
    await updateEnvAndCollectionSelects();
    renderHeaders();
    renderHistory();
    renderCollections();
    renderEnvironments();

    const lastItem = historyManager.getItems(1)[0];
    if (lastItem) {
        dom.methodSelect.value = lastItem.method;
        dom.urlInput.value = lastItem.url;
        if (lastItem.headers) state.headers = lastItem.headers;
        if (lastItem.body) dom.bodyEditor.value = lastItem.body;
        if (lastItem.bodyType) dom.bodyType.value = lastItem.bodyType;
        renderHeaders();
    }
}

init();
console.log('🚀 PingTo API Client loaded!');