import { StorageManager } from './modules/storage.js';
import { HistoryManager } from './modules/history.js';
import { CurlParser } from './modules/curl-parser.js';
import { ThemeManager } from './modules/theme.js';
import { UIHelpers } from './modules/ui-helpers.js';
import { CollectionsManager } from './modules/collections.js';
import { EnvironmentsManager } from './modules/environments.js';
import { I18nManager } from './modules/i18n.js';
import { CodeGenerator } from './modules/code-generator.js';
import { GraphQLManager } from './modules/graphql.js';
import { apiClient } from './modules/api-client.js';
import {
  applyEnvToHeaders,
  applyEnvVars,
  debounce,
  idsEqual,
  isHttpUrl,
  parseMultipartFields,
  sanitizeHeadersForStorage,
  utf8ToBase64,
} from './modules/request-utils.js';

const storage = new StorageManager();
const historyManager = new HistoryManager(storage);
const themeManager = new ThemeManager();
const collectionsManager = new CollectionsManager(storage);
const environmentsManager = new EnvironmentsManager(storage);

const SETTINGS_KEY = 'app_settings';
const ACTIVE_ENV_KEY = 'active_environment_id';
const FREE_HISTORY_LIMIT = 50;
const PRO_HISTORY_LIMIT = 500;

const state = {
  currentTab: 'request',
  currentReqTab: 'headers',
  currentRespTab: 'body',
  headers: [{ key: 'Content-Type', value: 'application/json' }],
  bodyType: 'json',
  authType: 'none',
  isSending: false,
  historyLimit: FREE_HISTORY_LIMIT,
  timeout: 30000,
};

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
  oauthTokenUrl: $('#oauthTokenUrl'),
  oauthClientId: $('#oauthClientId'),
  oauthClientSecret: $('#oauthClientSecret'),
  oauthScope: $('#oauthScope'),
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
  settingsModal: $('#settingsModal'),
  settingsTimeout: $('#settingsTimeout'),
  settingsHistoryMax: $('#settingsHistoryMax'),
  saveSettingsBtn: $('#saveSettingsBtn'),
  closeSettingsModal: $('#closeSettingsModal'),
};

let isPro = false;
let headersBound = false;

function safeAddListener(element, event, handler) {
  if (element) element.addEventListener(event, handler);
}

await I18nManager.init();

safeAddListener(dom.languageToggle, 'click', async () => {
  await I18nManager.toggle();
  renderAllDynamic();
});

document.addEventListener('languageChanged', () => {
  renderAllDynamic();
});

function collectHeadersObject() {
  const headers = {};
  state.headers.forEach((h) => {
    if (h.key.trim()) headers[h.key.trim()] = h.value;
  });
  return headers;
}

safeAddListener(dom.generateCodeBtn, 'click', () => {
  if (dom.codeModal) {
    dom.codeModal.classList.add('active');
    generateCode();
  }
});

function generateCode() {
  if (!dom.codeLanguage || !dom.codeOutput) return;
  const language = dom.codeLanguage.value;
  const code = CodeGenerator.generate(
    dom.methodSelect.value,
    dom.urlInput.value,
    collectHeadersObject(),
    dom.bodyEditor.value,
    language
  );
  dom.codeOutput.textContent = code;
}

safeAddListener(dom.codeLanguage, 'change', generateCode);
safeAddListener(dom.copyCodeBtn, 'click', async () => {
  if (!dom.codeOutput) return;
  await navigator.clipboard.writeText(dom.codeOutput.textContent);
  UIHelpers.showToast('Code copied to clipboard', 'success');
});
safeAddListener(dom.closeCodeModal, 'click', () => {
  if (dom.codeModal) dom.codeModal.classList.remove('active');
});
if (dom.codeModal) {
  dom.codeModal.addEventListener('click', (e) => {
    if (e.target === dom.codeModal) dom.codeModal.classList.remove('active');
  });
}

function applyProUi() {
  if (dom.proStatus) {
    dom.proStatus.textContent = isPro ? 'Pro' : 'Free';
    dom.proStatus.style.color = isPro ? '#22C55E' : '#9CA3AF';
  }
  document.querySelectorAll('.pro-feature').forEach((el) => {
    el.style.display = isPro ? 'block' : 'none';
    el.disabled = !isPro;
  });
}

if (dom.proToggle) {
  dom.proToggle.addEventListener('change', async () => {
    isPro = dom.proToggle.checked;
    applyProUi();
    await chrome.storage.local.set({ isPro });
    await loadSettings();
    UIHelpers.showToast(isPro ? 'Pro features unlocked!' : 'Free mode', isPro ? 'success' : 'info');
  });

  chrome.storage.local.get(['isPro'], (result) => {
    isPro = result.isPro || false;
    dom.proToggle.checked = isPro;
    applyProUi();
  });
}

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

function renderAllDynamic() {
  renderHeaders();
  renderHistory();
  renderCollections();
  renderEnvironments();
  updateEnvAndCollectionSelects();
}

function switchTab(tabId) {
  state.currentTab = tabId;
  $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tabId));
  $$('.tab-content').forEach((c) => c.classList.toggle('active', c.id === `tab-${tabId}`));
}

function switchReqTab(tabId) {
  state.currentReqTab = tabId;
  $$('.req-tab').forEach((t) => t.classList.toggle('active', t.dataset.reqtab === tabId));
  $$('.req-content').forEach((c) => c.classList.toggle('active', c.id === `req-${tabId}`));
}

function switchRespTab(tabId) {
  state.currentRespTab = tabId;
  $$('.resp-tab').forEach((t) => t.classList.toggle('active', t.dataset.resptab === tabId));
  $$('.resp-content').forEach((c) => c.classList.toggle('active', c.id === `resp-${tabId}`));
}

function bindHeaderEvents() {
  if (headersBound || !dom.headersList) return;
  headersBound = true;
  dom.headersList.addEventListener('input', (e) => {
    const keyIdx = e.target.dataset.headerKey;
    const valIdx = e.target.dataset.headerValue;
    if (keyIdx != null && state.headers[keyIdx]) state.headers[keyIdx].key = e.target.value;
    if (valIdx != null && state.headers[valIdx]) state.headers[valIdx].value = e.target.value;
  });
  dom.headersList.addEventListener('click', (e) => {
    const btn = e.target.closest('.remove-header');
    if (!btn) return;
    const idx = parseInt(btn.dataset.index, 10);
    state.headers.splice(idx, 1);
    renderHeaders();
  });
}

function renderHeaders() {
  if (!dom.headersList) return;
  bindHeaderEvents();
  dom.headersList.replaceChildren();

  state.headers.forEach((h, i) => {
    const row = document.createElement('div');
    row.className = 'header-row';

    const keyInput = document.createElement('input');
    keyInput.type = 'text';
    keyInput.placeholder = 'Key';
    keyInput.value = h.key;
    keyInput.dataset.headerKey = String(i);

    const valueInput = document.createElement('input');
    valueInput.type = 'text';
    valueInput.placeholder = 'Value';
    valueInput.value = h.value;
    valueInput.dataset.headerValue = String(i);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-header';
    removeBtn.dataset.index = String(i);
    removeBtn.textContent = '×';

    row.append(keyInput, valueInput, removeBtn);
    dom.headersList.appendChild(row);
  });
}

safeAddListener(dom.addHeaderBtn, 'click', () => {
  state.headers.push({ key: '', value: '' });
  renderHeaders();
});

safeAddListener(dom.addCommonHeadersBtn, 'click', () => {
  [
    { key: 'Content-Type', value: 'application/json' },
    { key: 'Accept', value: 'application/json' },
  ].forEach((h) => {
    if (!state.headers.find((existing) => existing.key === h.key)) state.headers.push(h);
  });
  renderHeaders();
  UIHelpers.showToast(I18nManager.t('commonHeadersBtn'), 'success');
});

function updateAuthFields() {
  if (dom.authToken) dom.authToken.style.display = state.authType === 'bearer' ? 'block' : 'none';
  if (dom.basicAuthFields) {
    dom.basicAuthFields.style.display =
      state.authType === 'basic' || state.authType === 'digest' ? 'block' : 'none';
  }
  if (dom.oauth2Fields) dom.oauth2Fields.style.display = state.authType === 'oauth2' ? 'block' : 'none';
}

safeAddListener(dom.authType, 'change', (e) => {
  state.authType = e.target.value;
  updateAuthFields();
});

safeAddListener(dom.bodyType, 'change', (e) => {
  state.bodyType = e.target.value;
  if (!dom.bodyEditor) return;
  dom.bodyEditor.style.display = state.bodyType === 'none' ? 'none' : 'block';
  const placeholders = {
    json: '{"key": "value"}',
    form: 'key1=value1&key2=value2',
    multipart: 'key1=value1\\nkey2=value2',
    text: 'Plain text...',
    graphql: '{"query": "...", "variables": {}}',
  };
  dom.bodyEditor.placeholder = placeholders[state.bodyType] || '';
});

async function getActiveEnvVars() {
  const envId = dom.environmentSelect?.value;
  if (!envId) return {};
  const env = await environmentsManager.getById(envId);
  return env?.variables || {};
}

async function fetchOAuthToken(variables) {
  const tokenUrl = applyEnvVars(dom.oauthTokenUrl?.value?.trim() || '', variables);
  const clientId = applyEnvVars(dom.oauthClientId?.value?.trim() || '', variables);
  const clientSecret = applyEnvVars(dom.oauthClientSecret?.value || '', variables);
  const scope = applyEnvVars(dom.oauthScope?.value?.trim() || '', variables);

  if (!isHttpUrl(tokenUrl) || !clientId || !clientSecret) {
    throw new Error('OAuth 2.0 requires token URL, client id and secret');
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  });
  if (scope) body.set('scope', scope);

  const response = await apiClient.sendRequest({
    method: 'POST',
    url: tokenUrl,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    timeout: state.timeout,
  });

  if (response.error || !response.ok) {
    throw new Error(response.error || `OAuth token request failed (${response.status})`);
  }

  let payload;
  try {
    payload = JSON.parse(response.body);
  } catch {
    throw new Error('OAuth token response is not JSON');
  }
  if (!payload.access_token) throw new Error('OAuth response has no access_token');
  return payload.access_token;
}

async function sendRequest() {
  if (state.isSending) return;
  state.isSending = true;
  if (dom.sendBtn) {
    dom.sendBtn.textContent = I18nManager.t('sendingBtn');
    dom.sendBtn.disabled = true;
  }

  try {
    const method = dom.methodSelect.value;
    let url = dom.urlInput.value.trim();
    if (!url) {
      UIHelpers.showToast(I18nManager.t('enterUrl'), 'error');
      return;
    }

    const variables = await getActiveEnvVars();
    url = applyEnvVars(url, variables);
    if (!isHttpUrl(url)) {
      UIHelpers.showToast(I18nManager.t('invalidUrl', 'Enter a valid http(s) URL'), 'error');
      return;
    }

    const headers = applyEnvToHeaders(collectHeadersObject(), variables);
    Object.keys(headers).forEach((key) => {
      headers[key] = applyEnvVars(headers[key], variables);
    });

    if (state.authType === 'bearer' && dom.authToken.value) {
      headers.Authorization = `Bearer ${applyEnvVars(dom.authToken.value, variables)}`;
    } else if (state.authType === 'basic') {
      const user = applyEnvVars(dom.basicUser.value, variables);
      const pass = applyEnvVars(dom.basicPass.value, variables);
      if (user) headers.Authorization = `Basic ${utf8ToBase64(`${user}:${pass}`)}`;
    } else if (state.authType === 'oauth2') {
      headers.Authorization = `Bearer ${await fetchOAuthToken(variables)}`;
    }

    let body = null;
    let multipart = null;
    const bodyType = dom.bodyType.value;
    if (bodyType !== 'none') {
      const rawBody = applyEnvVars(dom.bodyEditor.value, variables);
      if (bodyType === 'json' || bodyType === 'graphql') {
        try {
          JSON.parse(rawBody || 'null');
          body = rawBody;
          headers['Content-Type'] = headers['Content-Type'] || 'application/json';
        } catch {
          UIHelpers.showToast(I18nManager.t('invalidJson'), 'error');
          return;
        }
      } else if (bodyType === 'form') {
        body = rawBody;
        headers['Content-Type'] = headers['Content-Type'] || 'application/x-www-form-urlencoded';
      } else if (bodyType === 'multipart') {
        multipart = parseMultipartFields(rawBody);
        delete headers['Content-Type'];
        delete headers['content-type'];
      } else {
        body = rawBody;
      }
    }

    const digest =
      state.authType === 'digest'
        ? {
            username: applyEnvVars(dom.basicUser.value, variables),
            password: applyEnvVars(dom.basicPass.value, variables),
          }
        : null;

    const response = await apiClient.sendRequest({
      method,
      url,
      headers,
      body,
      timeout: state.timeout,
      multipart,
      digest,
    });

    displayResponse(response);

    if (response && !response.error) {
      try {
        await historyManager.add(
          {
            method,
            url,
            headers: sanitizeHeadersForStorage(state.headers),
            body: bodyType === 'none' ? '' : dom.bodyEditor.value,
            bodyType,
            authType: state.authType,
            status: response.status,
            time: response.time,
            size: response.size,
            timestamp: Date.now(),
          },
          state.historyLimit
        );
        renderHistory();
      } catch (err) {
        UIHelpers.showToast(`History not saved: ${err.message}`, 'error');
      }
    }

    switchTab('response');
  } catch (error) {
    UIHelpers.showToast(`${I18nManager.t('networkError')}: ${error.message}`, 'error');
    if (dom.responseBody) {
      dom.responseBody.textContent = `${I18nManager.t('responseError')}: ${error.message}`;
    }
  } finally {
    state.isSending = false;
    if (dom.sendBtn) {
      dom.sendBtn.textContent = I18nManager.t('sendBtn');
      dom.sendBtn.disabled = false;
    }
  }
}

safeAddListener(dom.sendBtn, 'click', sendRequest);
safeAddListener(dom.urlInput, 'keydown', (e) => {
  if (e.key === 'Enter') sendRequest();
});

if (chrome.commands?.onCommand) {
  chrome.commands.onCommand.addListener((command) => {
    if (command === 'send-request') sendRequest();
  });
}

function displayResponse(response) {
  if (!dom.responseStatus || !dom.responseBody) return;
  if (response.error) {
    dom.responseStatus.textContent = `${I18nManager.t('responseError')}: ${response.error}`;
    dom.responseBody.textContent = response.body || response.error;
    if (dom.responseTime) dom.responseTime.textContent = `${I18nManager.t('timeLabel')}: —`;
    if (dom.responseSize) dom.responseSize.textContent = `${I18nManager.t('sizeLabel')}: —`;
    if (dom.responsePreview) {
      dom.responsePreview.removeAttribute('srcdoc');
      dom.responsePreview.style.display = 'none';
    }
    return;
  }

  const statusEl = document.createElement('span');
  statusEl.style.color = response.ok ? '#22C55E' : '#EF4444';
  statusEl.style.fontWeight = '600';
  statusEl.textContent = `${response.status} ${response.statusText}`;
  dom.responseStatus.replaceChildren(document.createTextNode(`${I18nManager.t('statusLabel')}: `), statusEl);

  if (dom.responseTime) {
    dom.responseTime.textContent = `${I18nManager.t('timeLabel')}: ${UIHelpers.formatTime(response.time)}`;
  }
  if (dom.responseSize) {
    dom.responseSize.textContent = `${I18nManager.t('sizeLabel')}: ${UIHelpers.formatSize(response.size)}`;
  }

  let bodyText = response.body || '';
  try {
    bodyText = JSON.stringify(JSON.parse(response.body), null, 2);
  } catch {
    // keep as-is
  }
  if (response.truncated) {
    UIHelpers.showToast('Response truncated', 'info');
  }
  dom.responseBody.textContent = bodyText;
  if (dom.responseHeaders) {
    dom.responseHeaders.textContent = JSON.stringify(response.headers, null, 2);
  }

  const contentType = response.headers?.['content-type'] || '';
  if (dom.responsePreview && contentType.includes('text/html') && !response.truncated) {
    dom.responsePreview.srcdoc = response.body;
    dom.responsePreview.style.display = 'block';
  } else if (dom.responsePreview) {
    dom.responsePreview.removeAttribute('srcdoc');
    dom.responsePreview.style.display = 'none';
  }

  switchRespTab('body');
}

safeAddListener(dom.copyResponseBtn, 'click', async () => {
  if (!dom.responseBody) return;
  await navigator.clipboard.writeText(dom.responseBody.textContent);
  UIHelpers.showToast(I18nManager.t('copyResponseBtn'), 'success');
});

safeAddListener(dom.saveResponseBtn, 'click', () => {
  if (!dom.responseBody) return;
  UIHelpers.downloadText(`response_${Date.now()}.json`, dom.responseBody.textContent, 'application/json');
  UIHelpers.showToast(I18nManager.t('saveResponseBtn'), 'success');
});

function renderHistory() {
  if (!dom.historyList || !dom.historySearch) return;

  const search = dom.historySearch.value.toLowerCase();
  const items = historyManager.getItems(state.historyLimit);
  const filtered = items.filter(
    (item) =>
      (item.url || '').toLowerCase().includes(search) ||
      (item.method || '').toLowerCase().includes(search)
  );

  dom.historyList.replaceChildren();

  if (filtered.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.textContent = I18nManager.t('historyEmpty');
    dom.historyList.appendChild(emptyState);
    return;
  }

  filtered.forEach((item) => {
    const div = document.createElement('div');
    div.className = 'history-item';
    div.dataset.id = item.id;

    const methodSpan = document.createElement('span');
    methodSpan.className = 'h-method';
    methodSpan.textContent = item.method;

    const urlSpan = document.createElement('span');
    urlSpan.className = 'h-url';
    urlSpan.textContent = item.url;

    const statusSpan = document.createElement('span');
    statusSpan.className = `h-status ${item.status >= 200 && item.status < 300 ? 'success' : 'error'}`;
    statusSpan.textContent = item.status || '—';

    const timeSpan = document.createElement('span');
    timeSpan.className = 'h-time';
    timeSpan.textContent = new Date(item.timestamp).toLocaleString();

    div.append(methodSpan, urlSpan, statusSpan, timeSpan);
    div.addEventListener('click', () => {
      const restoredItem = getHistoryItemById(div.dataset.id);
      if (restoredItem) restoreRequest(restoredItem);
      else UIHelpers.showToast('Request not found in history', 'error');
    });
    dom.historyList.appendChild(div);
  });

  if (dom.historyLimit) {
    const total = historyManager.getAll().length;
    dom.historyLimit.textContent = `${I18nManager.t('historyLimit')} (${total}/${state.historyLimit})`;
  }
}

function restoreRequest(item, { silent = false } = {}) {
  if (item.method) dom.methodSelect.value = item.method;
  if (item.url) dom.urlInput.value = item.url;
  if (item.headers) state.headers = item.headers.map((h) => ({ key: h.key, value: h.value }));
  if (item.body != null && dom.bodyEditor) dom.bodyEditor.value = item.body;
  if (item.bodyType && dom.bodyType) {
    dom.bodyType.value = item.bodyType;
    state.bodyType = item.bodyType;
  }
  if (item.authType && dom.authType) {
    dom.authType.value = item.authType;
    state.authType = item.authType;
    updateAuthFields();
  }
  renderHeaders();
  if (!silent) {
    UIHelpers.showToast(I18nManager.t('restoreRequest'), 'success');
    switchTab('request');
  }
}

function getHistoryItemById(id) {
  let item = historyManager.getById(id);
  if (!item && /^\d+(\.\d+)?$/.test(id)) {
    item = historyManager.getByOldId(Number(id)) || historyManager.getAll().find((h) => String(h._oldId) === String(id));
  }
  return item;
}

safeAddListener(dom.historySearch, 'input', debounce(renderHistory, 150));

safeAddListener(dom.clearHistoryBtn, 'click', async () => {
  if (confirm(I18nManager.t('clearHistoryBtn'))) {
    await historyManager.clear();
    renderHistory();
  }
});

safeAddListener(dom.exportHistoryBtn, 'click', () => {
  UIHelpers.downloadText(
    `history_${Date.now()}.json`,
    JSON.stringify(historyManager.getItems(state.historyLimit), null, 2),
    'application/json'
  );
  UIHelpers.showToast(I18nManager.t('exportHistoryBtn'), 'success');
});

safeAddListener(dom.parseCurlBtn, 'click', () => {
  try {
    const parsed = CurlParser.parse(dom.curlInput.value);
    if (!parsed.url) throw new Error('URL not found');
    dom.methodSelect.value = parsed.method;
    dom.urlInput.value = parsed.url;
    state.headers = parsed.headers.length ? parsed.headers : [{ key: '', value: '' }];
    if (parsed.body) {
      dom.bodyEditor.value = parsed.body;
      dom.bodyType.value = 'json';
      state.bodyType = 'json';
    }
    renderHeaders();
    UIHelpers.showToast(I18nManager.t('curlImported'), 'success');
    switchTab('request');
  } catch (error) {
    UIHelpers.showToast(`${I18nManager.t('curlImported')}: ${error.message}`, 'error');
  }
});

safeAddListener(dom.exportCurlBtn, 'click', async () => {
  const curl = CurlParser.stringify(
    dom.methodSelect.value,
    dom.urlInput.value,
    state.headers,
    dom.bodyType.value !== 'none' ? dom.bodyEditor.value : ''
  );
  await navigator.clipboard.writeText(curl);
  UIHelpers.showToast(I18nManager.t('curlExport'), 'success');
});

async function renderCollections() {
  if (!dom.collectionsList) return;
  const collections = await collectionsManager.getAll();
  dom.collectionsList.replaceChildren();

  if (!collections.length) {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.textContent = I18nManager.t('collectionsEmpty');
    dom.collectionsList.appendChild(emptyState);
    return;
  }

  collections.forEach((coll) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'collection-item';

    const header = document.createElement('div');
    header.className = 'coll-header';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'coll-name';
    nameSpan.textContent = coll.name;

    const actions = document.createElement('div');
    actions.className = 'coll-actions';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-secondary small';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm('Delete this collection?')) {
        await collectionsManager.delete(coll.id);
        renderCollections();
        updateEnvAndCollectionSelects();
      }
    });

    const exportBtn = document.createElement('button');
    exportBtn.className = 'btn-secondary small';
    exportBtn.textContent = 'Export';
    exportBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const data = await collectionsManager.exportOne(coll.id);
      if (data) {
        UIHelpers.downloadText(
          `collection_${coll.name.replace(/[^\w.-]+/g, '_')}_${Date.now()}.json`,
          JSON.stringify(data, null, 2)
        );
        UIHelpers.showToast('Collection exported', 'success');
      }
    });

    actions.append(deleteBtn, exportBtn);
    header.append(nameSpan, actions);
    wrapper.appendChild(header);

    if (coll.requests?.length) {
      coll.requests.forEach((req) => {
        const reqDiv = document.createElement('div');
        reqDiv.className = 'coll-request';
        const reqInfo = document.createElement('span');
        const methodStrong = document.createElement('strong');
        methodStrong.textContent = req.method || 'GET';
        reqInfo.append(methodStrong, document.createTextNode(` ${req.url || ''}`));

        const runBtn = document.createElement('button');
        runBtn.className = 'btn-secondary small';
        runBtn.textContent = 'Load';
        runBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const loadedColl = await collectionsManager.getById(coll.id);
          const loadedReq = loadedColl?.requests?.find((r) => idsEqual(r.id, req.id));
          if (loadedReq) restoreRequest(loadedReq);
        });

        reqDiv.append(reqInfo, runBtn);
        wrapper.appendChild(reqDiv);
      });
    }

    dom.collectionsList.appendChild(wrapper);
  });
}

safeAddListener(dom.newCollectionBtn, 'click', async () => {
  const name = prompt(I18nManager.t('newCollectionBtn'));
  if (name) {
    await collectionsManager.create(name.trim());
    renderCollections();
    updateEnvAndCollectionSelects();
  }
});

safeAddListener(dom.importCollectionBtn, 'click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.onchange = async (e) => {
    try {
      const file = e.target.files[0];
      if (!file) return;
      const data = JSON.parse(await file.text());
      await collectionsManager.import(data);
      renderCollections();
      updateEnvAndCollectionSelects();
      UIHelpers.showToast(I18nManager.t('importCollectionBtn'), 'success');
    } catch (error) {
      UIHelpers.showToast('Error importing collection: ' + error.message, 'error');
    }
  };
  input.click();
});

safeAddListener(dom.exportAllCollectionsBtn, 'click', async () => {
  const data = await collectionsManager.exportAll();
  UIHelpers.downloadText(`collections_${Date.now()}.json`, JSON.stringify(data, null, 2));
  UIHelpers.showToast(I18nManager.t('exportAllCollectionsBtn'), 'success');
});

async function renderEnvironments() {
  if (!dom.environmentsList) return;
  const environments = await environmentsManager.getAll();
  dom.environmentsList.replaceChildren();

  if (!environments.length) {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.textContent = I18nManager.t('environmentsEmpty');
    dom.environmentsList.appendChild(emptyState);
    return;
  }

  environments.forEach((env) => {
    const item = document.createElement('div');
    item.className = 'environment-item';
    const header = document.createElement('div');
    header.className = 'env-header';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'env-name';
    nameSpan.textContent = env.name;

    const actions = document.createElement('div');
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-secondary small';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm('Delete this environment?')) {
        await environmentsManager.delete(env.id);
        renderEnvironments();
        updateEnvAndCollectionSelects();
      }
    });

    const activateBtn = document.createElement('button');
    activateBtn.className = 'btn-secondary small';
    activateBtn.textContent = 'Use';
    activateBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (dom.environmentSelect) {
        dom.environmentSelect.value = String(env.id);
        await storage.set(ACTIVE_ENV_KEY, env.id);
      }
      UIHelpers.showToast(`Environment "${env.name}" selected`, 'success');
    });

    actions.append(deleteBtn, activateBtn);
    header.append(nameSpan, actions);
    item.appendChild(header);

    Object.entries(env.variables || {}).forEach(([key, value]) => {
      const varDiv = document.createElement('div');
      varDiv.className = 'env-var';
      const keySpan = document.createElement('span');
      keySpan.className = 'var-key';
      keySpan.textContent = `{{${key}}}`;
      const valueSpan = document.createElement('span');
      valueSpan.textContent = String(value);
      varDiv.append(keySpan, valueSpan);
      item.appendChild(varDiv);
    });

    dom.environmentsList.appendChild(item);
  });
}

safeAddListener(dom.newEnvironmentBtn, 'click', async () => {
  const name = prompt(I18nManager.t('newEnvironmentBtn'));
  if (!name) return;
  const variables = {};
  while (true) {
    const key = prompt('Variable key (cancel to finish):');
    if (!key) break;
    const value = prompt(`Value for ${key}:`);
    if (value !== null) variables[key] = value;
  }
  await environmentsManager.create(name.trim(), variables);
  renderEnvironments();
  updateEnvAndCollectionSelects();
});

async function updateEnvAndCollectionSelects() {
  if (!dom.environmentSelect || !dom.collectionSelect) return;
  const selectedEnv = dom.environmentSelect.value;
  const selectedColl = dom.collectionSelect.value;

  const envs = await environmentsManager.getAll();
  dom.environmentSelect.replaceChildren();
  const defaultEnvOption = document.createElement('option');
  defaultEnvOption.value = '';
  defaultEnvOption.textContent = I18nManager.t('noEnvironment');
  dom.environmentSelect.appendChild(defaultEnvOption);
  envs.forEach((env) => {
    const option = document.createElement('option');
    option.value = String(env.id);
    option.textContent = env.name;
    dom.environmentSelect.appendChild(option);
  });
  if (selectedEnv) dom.environmentSelect.value = selectedEnv;

  const colls = await collectionsManager.getAll();
  dom.collectionSelect.replaceChildren();
  const defaultCollOption = document.createElement('option');
  defaultCollOption.value = '';
  defaultCollOption.textContent = I18nManager.t('noCollection');
  dom.collectionSelect.appendChild(defaultCollOption);
  colls.forEach((coll) => {
    const option = document.createElement('option');
    option.value = String(coll.id);
    option.textContent = coll.name;
    dom.collectionSelect.appendChild(option);
  });
  if (selectedColl) dom.collectionSelect.value = selectedColl;
}

safeAddListener(dom.environmentSelect, 'change', async () => {
  await storage.set(ACTIVE_ENV_KEY, dom.environmentSelect.value || null);
});

safeAddListener(dom.saveToCollectionBtn, 'click', async () => {
  const collectionId = dom.collectionSelect.value;
  if (!collectionId) {
    UIHelpers.showToast('Select a collection first', 'error');
    return;
  }
  const saved = await collectionsManager.addRequest(collectionId, {
    id: Date.now(),
    method: dom.methodSelect.value,
    url: dom.urlInput.value,
    headers: state.headers,
    body: dom.bodyEditor.value,
    bodyType: dom.bodyType.value,
    authType: dom.authType.value,
  });
  if (!saved) {
    UIHelpers.showToast('Collection not found', 'error');
    return;
  }
  UIHelpers.showToast(I18nManager.t('saveToCollectionBtn'), 'success');
  renderCollections();
});

safeAddListener(dom.saveAsEnvBtn, 'click', async () => {
  const name = prompt('Enter environment name:');
  if (!name) return;
  const variables = {};
  try {
    const url = new URL(dom.urlInput.value);
    url.searchParams.forEach((value, key) => {
      variables[key] = value;
    });
  } catch {
    // ignore invalid URL
  }
  await environmentsManager.create(name.trim(), variables);
  renderEnvironments();
  updateEnvAndCollectionSelects();
  UIHelpers.showToast('Environment saved successfully!', 'success');
});

safeAddListener(dom.fullscreenBtn, 'click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
});

safeAddListener(dom.websocketBtn, 'click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('pages/websocket.html') });
});

safeAddListener(dom.graphqlPlayBtn, 'click', async () => {
  const query = GraphQLManager.formatQuery(dom.graphqlQuery?.value);
  const valid = GraphQLManager.validateQuery(query);
  if (valid !== true) {
    UIHelpers.showToast(valid, 'error');
    return;
  }
  let variables = {};
  try {
    variables = GraphQLManager.parseVariables(dom.graphqlVariables?.value);
  } catch (error) {
    UIHelpers.showToast(error.message, 'error');
    return;
  }
  dom.methodSelect.value = 'POST';
  dom.bodyType.value = 'json';
  state.bodyType = 'json';
  dom.bodyEditor.value = GraphQLManager.buildPayload(query, variables);
  if (!state.headers.find((h) => h.key.toLowerCase() === 'content-type')) {
    state.headers.push({ key: 'Content-Type', value: 'application/json' });
    renderHeaders();
  }
  await sendRequest();
});

function openSettings() {
  if (dom.settingsTimeout) dom.settingsTimeout.value = String(state.timeout);
  if (dom.settingsHistoryMax) dom.settingsHistoryMax.value = String(state.historyLimit);
  if (dom.settingsModal) dom.settingsModal.classList.add('active');
}

safeAddListener(dom.settingsBtn, 'click', openSettings);
safeAddListener(dom.closeSettingsModal, 'click', () => {
  dom.settingsModal?.classList.remove('active');
});
if (dom.settingsModal) {
  dom.settingsModal.addEventListener('click', (e) => {
    if (e.target === dom.settingsModal) dom.settingsModal.classList.remove('active');
  });
}

safeAddListener(dom.saveSettingsBtn, 'click', async () => {
  const timeout = Math.min(120000, Math.max(1000, Number(dom.settingsTimeout.value) || 30000));
  const defaultLimit = isPro ? PRO_HISTORY_LIMIT : FREE_HISTORY_LIMIT;
  const historyMax = Math.min(defaultLimit, Math.max(10, Number(dom.settingsHistoryMax.value) || defaultLimit));
  state.timeout = timeout;
  state.historyLimit = historyMax;
  await storage.set(SETTINGS_KEY, { timeout, historyMax });
  renderHistory();
  dom.settingsModal?.classList.remove('active');
  UIHelpers.showToast('Settings saved', 'success');
});

safeAddListener(dom.licenseBtn, 'click', () => {
  alert(I18nManager.t('proFeatures'));
});

function initTabs() {
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', function () {
      const tabId = this.dataset.tab;
      const proTabs = ['collections', 'environments'];
      if (proTabs.includes(tabId) && !isPro) {
        UIHelpers.showToast(`${tabId} is a Pro feature. Enable Pro in the header toggle.`, 'info');
      }
      switchTab(tabId);
      if (tabId === 'history') renderHistory();
      if (tabId === 'collections') renderCollections();
      if (tabId === 'environments') renderEnvironments();
    });
  });
  document.querySelectorAll('.req-tab').forEach((btn) => {
    btn.addEventListener('click', function () {
      switchReqTab(this.dataset.reqtab);
    });
  });
  document.querySelectorAll('.resp-tab').forEach((btn) => {
    btn.addEventListener('click', function () {
      switchRespTab(this.dataset.resptab);
    });
  });
}

async function loadSettings() {
  const saved = (await storage.get(SETTINGS_KEY, {})) || {};
  const defaultLimit = isPro ? PRO_HISTORY_LIMIT : FREE_HISTORY_LIMIT;
  state.timeout = Number(saved.timeout) || 30000;
  state.historyLimit = Math.min(defaultLimit, Number(saved.historyMax) || defaultLimit);
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'loadRequest' && message.data) {
    restoreRequest(message.data);
  }
  if (message.type === 'activateEnvironment' && message.data?.id && dom.environmentSelect) {
    dom.environmentSelect.value = String(message.data.id);
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.api_collections) {
    collectionsManager.loaded = false;
    renderCollections();
    updateEnvAndCollectionSelects();
  }
  if (changes.api_environments) {
    environmentsManager.loaded = false;
    renderEnvironments();
    updateEnvAndCollectionSelects();
  }
});

async function init() {
  await loadSettings();
  await historyManager.load();
  await updateEnvAndCollectionSelects();
  const activeEnvId = await storage.get(ACTIVE_ENV_KEY, '');
  if (activeEnvId && dom.environmentSelect) {
    dom.environmentSelect.value = String(activeEnvId);
  }
  const pending = await storage.get('pending_request', null);
  if (pending) {
    restoreRequest(pending);
    await storage.remove('pending_request');
  }
  initTabs();
  renderHeaders();
  renderHistory();
  renderCollections();
  renderEnvironments();

  const lastItem = historyManager.getLast();
  if (lastItem && !pending) {
    restoreRequest(lastItem, { silent: true });
  }
}

init();
