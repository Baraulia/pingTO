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
  isHttpUrl,
  isWebSocketUrl,
  parseMultipartFields,
  sanitizeHeadersForStorage,
  utf8ToBase64,
} from './modules/request-utils.js';
import { applyParamsToUrl, applyPathParams, parseUrlParams } from './modules/url-params.js';
import {
  diffText,
  formatJson,
  highlightJson,
  hintForResponse,
  jsonError,
  minifyJson,
  prettyXml,
  queryJsonPath,
} from './modules/json-tools.js';
import { detectAndImport } from './modules/importers.js';
import { downloadBruZipLike, sanitizeExport } from './modules/bruno-export.js';
import { exchangeCode, launchAuthCode, refreshToken } from './modules/oauth.js';
import { runPreRequest, runTests } from './modules/sandbox.js';
import {
  emptyRequest,
  newId,
  searchRequests,
} from './modules/collection-tree.js';
import { introspect, suggestGraphql } from './modules/graphql-schema.js';
import {
  FREE_AUTH,
  FREE_BODY,
  FREE_HISTORY_LIMIT,
  FREE_REQ_PANES,
  FREE_RESP_PANES,
  FREE_TAB_LIMIT,
  PRO_FEATURES,
  historyLimitFor,
} from './modules/entitlements.js';

const storage = new StorageManager();
const historyManager = new HistoryManager(storage);
const themeManager = new ThemeManager();
const collectionsManager = new CollectionsManager(storage);
const environmentsManager = new EnvironmentsManager(storage);

const $ = (id) => document.getElementById(id);
const state = {
  isPro: false,
  tabs: [],
  activeId: null,
  timeout: 30000,
  historyLimit: 50,
  sendingId: null,
  gqlSchema: null,
  lastRequest: null,
  selectedCollectionId: null,
  selectedFolderId: null,
  treeMenuTarget: null,
};

const socketSession = { ws: null, sse: null, reconnectTimer: null, manualClose: false };

function isSocketMethod(method) {
  return method === 'WS' || method === 'SSE';
}

function featureName(id) {
  const key = PRO_FEATURES[id];
  return key ? I18nManager.t(key) : id;
}

function showProModal(featureId) {
  const name = featureName(featureId);
  $('proModalText').textContent = I18nManager.t('proModalText').replace('{name}', name);
  const list = $('proModalList');
  list.replaceChildren();
  const title = document.createElement('p');
  title.textContent = I18nManager.t('proFeatureListTitle');
  list.appendChild(title);
  ['tabCollections', 'tabEnvironments', 'graphqlTab', 'websocketBtn', 'scriptsTab', 'generateCodeBtn', 'authOauth2'].forEach((key) => {
    const li = document.createElement('li');
    li.textContent = I18nManager.t(key);
    list.appendChild(li);
  });
  $('proModal').classList.remove('hidden');
}

function requirePro(featureId) {
  if (state.isPro) return true;
  showProModal(featureId);
  return false;
}

function syncProOptionLabels() {
  document.querySelectorAll('option[data-pro]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const base = key ? I18nManager.t(key) : (el.dataset.proBase || el.textContent.replace(/\s·\sPRO$/, ''));
    el.dataset.proBase = base;
    el.textContent = state.isPro ? base : `${base} · PRO`;
  });
}

function applyProUi() {
  document.body.classList.toggle('is-pro', state.isPro);
  document.body.classList.toggle('is-free', !state.isPro);
  syncProOptionLabels();
  state.historyLimit = historyLimitFor(state.isPro);
  const maxInput = $('settingsHistoryMax');
  if (maxInput) {
    maxInput.max = String(state.historyLimit);
    if (Number(maxInput.value) > state.historyLimit) maxInput.value = String(state.historyLimit);
  }
  $('historyProHint')?.toggleAttribute('hidden', state.isPro);
  if (historyManager.items?.length > state.historyLimit) {
    historyManager.items = historyManager.items.slice(0, state.historyLimit);
    historyManager.save();
  }

  if (!state.isPro) {
    if (state.tabs.length > FREE_TAB_LIMIT) {
      state.tabs = state.tabs.slice(0, FREE_TAB_LIMIT);
      state.activeId = state.tabs[0].id;
    }
    state.tabs.forEach((tab) => {
      if (!FREE_AUTH.has(tab.authType)) tab.authType = 'none';
      if (!FREE_BODY.has(tab.bodyType)) tab.bodyType = 'json';
      if (isSocketMethod(tab.method)) tab.method = 'GET';
    });
    if ($('environmentSelect')) $('environmentSelect').value = '';
    const auth = $('authType');
    if (auth && !FREE_AUTH.has(auth.value)) {
      auth.value = 'none';
      toggleAuth();
    }
    const body = $('bodyType');
    if (body && !FREE_BODY.has(body.value)) {
      body.value = 'json';
    }
    const pane = document.querySelector('#reqSubtabs button.active')?.dataset.pane;
    if (pane && !FREE_REQ_PANES.has(pane)) showPane('params');
    const rpane = document.querySelector('#respSubtabs button.active')?.dataset.rpane;
    if (rpane && !FREE_RESP_PANES.has(rpane)) showResp('body');
    renderTabs();
    persistWorkspace();
  }
  if (state.tabs.length) writeTabToForm();
}

async function setPro(enabled) {
  state.isPro = Boolean(enabled);
  $('proToggle').checked = state.isPro;
  await chrome.storage.local.set({ isPro: state.isPro });
  applyProUi();
  persistWorkspace();
}

function current() {
  return state.tabs.find((t) => t.id === state.activeId) || state.tabs[0];
}

function tabFromDraft(partial = {}) {
  return {
    ...emptyRequest(partial),
    id: partial.id || newId(),
    params: partial.params || parseUrlParams(partial.url || ''),
    pathParams: partial.pathParams || [],
    auth: {
      token: '',
      user: '',
      pass: '',
      apiKeyName: 'X-API-Key',
      apiKeyValue: '',
      apiKeyIn: 'header',
      grant: 'client_credentials',
      authUrl: '',
      tokenUrl: '',
      clientId: '',
      clientSecret: '',
      scope: '',
      refresh: '',
      ...(partial.auth || {}),
    },
    files: [],
    binary: null,
    response: null,
    snapshot: null,
    testResults: [],
    collectionId: partial.collectionId || null,
    collectionItemId: partial.collectionItemId || null,
  };
}

async function persistWorkspace() {
  await storage.set('workspace_tabs', {
    tabs: state.tabs.map(({ files, binary, ...rest }) => rest),
    activeId: state.activeId,
  });
  scheduleCollectionSync();
}

function collectionRequestPayload(tab) {
  return {
    type: 'request',
    id: tab.collectionItemId,
    name: tab.name,
    method: tab.method,
    url: tab.url,
    headers: tab.headers,
    params: tab.params,
    pathParams: tab.pathParams,
    bodyType: tab.bodyType,
    body: tab.body,
    authType: tab.authType,
    auth: tab.auth,
    preRequest: tab.preRequest,
    tests: tab.tests,
    docs: tab.docs,
    graphqlQuery: tab.graphqlQuery,
    graphqlVariables: tab.graphqlVariables,
    followRedirects: tab.followRedirects,
  };
}

async function syncOpenTabToCollection() {
  if (!state.isPro) return;
  const tab = current();
  if (!tab?.collectionId || !tab.collectionItemId) return;
  await collectionsManager.updateRequest(tab.collectionId, tab.collectionItemId, collectionRequestPayload(tab));
}

const scheduleCollectionSync = debounce(() => {
  syncOpenTabToCollection();
}, 500);

function findOpenCollectionTab(collectionId, itemId) {
  return state.tabs.find(
    (t) => String(t.collectionId) === String(collectionId) && String(t.collectionItemId) === String(itemId)
  );
}

function bindKv(container, list, fields, onChange) {
  container.replaceChildren();
  list.forEach((row, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'kv-row';
    const enabled = document.createElement('input');
    enabled.type = 'checkbox';
    enabled.checked = row.enabled !== false;
    enabled.onchange = () => {
      row.enabled = enabled.checked;
      onChange();
    };
    fields.forEach((field) => {
      const input = document.createElement('input');
      input.placeholder = field;
      input.value = row[field] || '';
      input.oninput = () => {
        row[field] = input.value;
        onChange();
      };
      wrap.appendChild(input);
    });
    const del = document.createElement('button');
    del.className = 'btn small';
    del.textContent = '×';
    del.onclick = () => {
      list.splice(i, 1);
      onChange();
      bindKv(container, list, fields, onChange);
    };
    wrap.prepend(enabled);
    wrap.appendChild(del);
    container.appendChild(wrap);
  });
}

function readFormIntoTab() {
  const tab = current();
  if (!tab) return;
  tab.method = $('methodSelect').value;
  tab.url = $('urlInput').value;
  tab.bodyType = $('bodyType').value;
  tab.body = $('bodyEditor').value;
  tab.authType = $('authType').value;
  tab.auth.token = $('authToken').value;
  tab.auth.user = $('basicUser').value;
  tab.auth.pass = $('basicPass').value;
  tab.auth.apiKeyName = $('apiKeyName').value;
  tab.auth.apiKeyValue = $('apiKeyValue').value;
  tab.auth.apiKeyIn = $('apiKeyIn').value;
  tab.auth.grant = $('oauthGrant').value;
  tab.auth.authUrl = $('oauthAuthUrl').value;
  tab.auth.tokenUrl = $('oauthTokenUrl').value;
  tab.auth.clientId = $('oauthClientId').value;
  tab.auth.clientSecret = $('oauthClientSecret').value;
  tab.auth.scope = $('oauthScope').value;
  tab.auth.refresh = $('oauthRefresh').value;
  tab.preRequest = $('preRequest').value;
  tab.tests = $('tests').value;
  tab.docs = $('docs').value;
  tab.name = $('reqName').value.trim() || tab.name;
  tab.graphqlQuery = $('graphqlQuery').value;
  tab.graphqlVariables = $('graphqlVariables').value;
  tab.followRedirects = $('followRedirects').checked;
}

function writeTabToForm() {
  const tab = current();
  if (!tab) return;
  $('methodSelect').value = tab.method;
  $('urlInput').value = tab.url;
  $('bodyType').value = tab.bodyType;
  $('bodyEditor').value = tab.body || '';
  $('authType').value = tab.authType;
  $('authToken').value = tab.auth.token || '';
  $('basicUser').value = tab.auth.user || '';
  $('basicPass').value = tab.auth.pass || '';
  $('apiKeyName').value = tab.auth.apiKeyName || 'X-API-Key';
  $('apiKeyValue').value = tab.auth.apiKeyValue || '';
  $('apiKeyIn').value = tab.auth.apiKeyIn || 'header';
  $('oauthGrant').value = tab.auth.grant || 'client_credentials';
  $('oauthAuthUrl').value = tab.auth.authUrl || '';
  $('oauthTokenUrl').value = tab.auth.tokenUrl || '';
  $('oauthClientId').value = tab.auth.clientId || '';
  $('oauthClientSecret').value = tab.auth.clientSecret || '';
  $('oauthScope').value = tab.auth.scope || '';
  $('oauthRefresh').value = tab.auth.refresh || '';
  $('preRequest').value = tab.preRequest || '';
  $('tests').value = tab.tests || '';
  $('docs').value = tab.docs || '';
  $('reqName').value = tab.name || '';
  $('graphqlQuery').value = tab.graphqlQuery || '';
  $('graphqlVariables').value = tab.graphqlVariables || '';
  $('followRedirects').checked = tab.followRedirects !== false;
  toggleAuth();
  renderKvs();
  renderResponse(tab);
  renderTabs();
  syncWorkspaceMode();
  updateEnvHint();
}

function renderKvs() {
  const tab = current();
  bindKv($('queryList'), tab.params, ['key', 'value'], () => {
    tab.url = applyParamsToUrl(tab.url.split('?')[0], tab.params);
    $('urlInput').value = tab.url;
    scheduleCollectionSync();
  });
  bindKv($('pathList'), tab.pathParams, ['key', 'value'], () => scheduleCollectionSync());
  bindKv($('headersList'), tab.headers, ['key', 'value'], () => scheduleCollectionSync());
}

function renderTabs() {
  const box = $('reqTabs');
  box.replaceChildren();
  state.tabs.forEach((tab) => {
    const chip = document.createElement('div');
    chip.className = `tab-chip${tab.id === state.activeId ? ' active' : ''}`;
    const m = document.createElement('span');
    m.className = `method ${tab.method}`;
    m.textContent = tab.method;
    const name = document.createElement('span');
    name.className = 'tab-chip-name';
    name.textContent = tab.name || I18nManager.t('defaultRequestName');
    name.title = I18nManager.t('renameRequestHint');
    name.ondblclick = (e) => {
      e.stopPropagation();
      state.activeId = tab.id;
      writeTabToForm();
      const input = $('reqName');
      input.focus();
      input.select();
    };
    const close = document.createElement('span');
    close.textContent = '×';
    close.onclick = (e) => {
      e.stopPropagation();
      closeTab(tab.id);
    };
    chip.append(m, name, close);
    chip.onclick = () => {
      if (tab.id !== state.activeId) closeSocket(true);
      readFormIntoTab();
      state.activeId = tab.id;
      writeTabToForm();
    };
    box.appendChild(chip);
  });
  const add = document.createElement('button');
  add.className = 'btn small';
  add.textContent = '+';
  add.dataset.pro = 'extraTabs';
  add.onclick = () => openTab();
  box.appendChild(add);
}

function replaceActiveTab(partial) {
  const prev = current();
  const tab = tabFromDraft({ ...(prev || {}), ...partial, id: prev?.id || newId() });
  if (prev) {
    const i = state.tabs.findIndex((t) => t.id === prev.id);
    state.tabs[i] = tab;
  } else {
    state.tabs = [tab];
  }
  state.activeId = tab.id;
  writeTabToForm();
  persistWorkspace();
}

function openTab(partial) {
  if (partial?.collectionId && partial?.collectionItemId) {
    const existing = findOpenCollectionTab(partial.collectionId, partial.collectionItemId);
    if (existing) {
      if (state.tabs.length && existing.id !== state.activeId) readFormIntoTab();
      if (existing.id !== state.activeId) {
        closeSocket(true);
        state.activeId = existing.id;
        writeTabToForm();
      }
      return existing;
    }
  }
  if (!state.isPro) {
    if (partial) {
      replaceActiveTab(partial);
      return;
    }
    if (state.tabs.length >= FREE_TAB_LIMIT) {
      requirePro('extraTabs');
      return;
    }
  }
  if (state.tabs.length) readFormIntoTab();
  const tab = tabFromDraft(partial);
  state.tabs.push(tab);
  state.activeId = tab.id;
  writeTabToForm();
  persistWorkspace();
}

function closeTab(id) {
  if (state.tabs.length === 1) return;
  state.tabs = state.tabs.filter((t) => t.id !== id);
  if (state.activeId === id) state.activeId = state.tabs[0].id;
  writeTabToForm();
}

function toggleAuth() {
  const type = $('authType').value;
  $('authToken').classList.toggle('hidden', type !== 'bearer');
  $('basicAuthFields').classList.toggle('hidden', type !== 'basic' && type !== 'digest');
  $('apiKeyFields').classList.toggle('hidden', type !== 'apikey');
  $('oauth2Fields').classList.toggle('hidden', type !== 'oauth2');
}

function syncWorkspaceMode() {
  const socket = isSocketMethod($('methodSelect').value);
  $('httpActions')?.classList.toggle('hidden', socket);
  $('wsActions')?.classList.toggle('hidden', !socket);
  $('httpSplit')?.classList.toggle('hidden', socket);
  $('wsWorkspace')?.classList.toggle('hidden', !socket);
  if (socket) {
    $('urlInput').placeholder = $('methodSelect').value === 'SSE' ? 'https://example.com/events' : 'wss://echo.websocket.org';
    $('wsSendBtn')?.classList.toggle('hidden', $('methodSelect').value === 'SSE');
    $('wsMessageInput')?.classList.toggle('hidden', $('methodSelect').value === 'SSE');
  } else {
    $('urlInput').placeholder = I18nManager.t('urlPlaceholder');
  }
}

function addWsMessage(type, content) {
  const box = $('wsMessages');
  if (!box) return;
  const div = document.createElement('div');
  div.className = `ws-msg ${type}`;
  const time = document.createElement('span');
  time.className = 'time';
  time.textContent = new Date().toLocaleTimeString();
  div.append(time, document.createTextNode(` ${String(content ?? '')}`));
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function setWsConnected(connected) {
  const status = $('wsStatus');
  if (status) {
    status.className = `ws-status ${connected ? 'online' : 'offline'}`;
    status.textContent = I18nManager.t(connected ? 'wsOnline' : 'wsOffline');
  }
  $('wsConnectBtn')?.classList.toggle('hidden', connected);
  $('wsDisconnectBtn')?.classList.toggle('hidden', !connected);
}

function closeSocket(manual = true) {
  socketSession.manualClose = manual;
  clearTimeout(socketSession.reconnectTimer);
  if (socketSession.ws) {
    socketSession.ws.onclose = null;
    socketSession.ws.close();
    socketSession.ws = null;
  }
  if (socketSession.sse) {
    socketSession.sse.close();
    socketSession.sse = null;
  }
  setWsConnected(false);
}

function prettyMaybe(data) {
  try {
    return JSON.stringify(JSON.parse(data), null, 2);
  } catch {
    return String(data);
  }
}

async function connectSocket() {
  if (!requirePro('websocket')) return;
  readFormIntoTab();
  const tab = current();
  const variables = await envVars();
  const url = applyEnvVars(tab.url.trim(), variables);
  closeSocket(true);
  socketSession.manualClose = false;
  if (tab.method === 'SSE') {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error(I18nManager.t('wsSseHttp'));
    } catch (e) {
      addWsMessage('error', e.message || I18nManager.t('invalidUrl'));
      return;
    }
    socketSession.sse = new EventSource(url);
    socketSession.sse.onopen = () => {
      setWsConnected(true);
      addWsMessage('sent', `SSE ${url}`);
    };
    socketSession.sse.onmessage = (event) => addWsMessage('received', prettyMaybe(event.data));
    socketSession.sse.onerror = () => {
      addWsMessage('error', 'SSE');
      if (!socketSession.manualClose && $('wsReconnect').checked) {
        socketSession.reconnectTimer = setTimeout(connectSocket, 1500);
      } else setWsConnected(false);
    };
    return;
  }
  if (!isWebSocketUrl(url)) {
    addWsMessage('error', I18nManager.t('wsNeedUrl'));
    return;
  }
  try {
    socketSession.ws = new WebSocket(url);
    socketSession.ws.onopen = () => {
      setWsConnected(true);
      addWsMessage('sent', url);
    };
    socketSession.ws.onmessage = (event) => addWsMessage('received', prettyMaybe(event.data));
    socketSession.ws.onerror = () => addWsMessage('error', I18nManager.t('wsError'));
    socketSession.ws.onclose = () => {
      setWsConnected(false);
      addWsMessage('error', I18nManager.t('wsOffline'));
      if (!socketSession.manualClose && $('wsReconnect').checked) {
        socketSession.reconnectTimer = setTimeout(connectSocket, 1500);
      }
    };
  } catch (error) {
    addWsMessage('error', error.message);
  }
}

function sendWsMessage() {
  if ($('methodSelect').value === 'SSE') {
    addWsMessage('error', I18nManager.t('wsSseReceiveOnly'));
    return;
  }
  if (!socketSession.ws || socketSession.ws.readyState !== WebSocket.OPEN) {
    addWsMessage('error', I18nManager.t('wsNotConnected'));
    return;
  }
  const message = $('wsMessageInput').value;
  if (!message.trim()) return;
  socketSession.ws.send(message);
  addWsMessage('sent', prettyMaybe(message));
  $('wsMessageInput').value = '';
}

function openSocketWorkspace() {
  if (!requirePro('websocket')) return;
  readFormIntoTab();
  const tab = current();
  tab.method = 'WS';
  if (!tab.url || tab.url.startsWith('http')) tab.url = 'wss://echo.websocket.org';
  writeTabToForm();
}

async function updateEnvHint() {
  const hint = $('urlHint');
  if (!hint) return;
  if (!state.isPro) {
    hint.textContent = I18nManager.t('urlPlaceholder');
    return;
  }
  const selected = $('environmentSelect')?.value;
  if (!selected) {
    hint.textContent = I18nManager.t('envHintSelect');
    return;
  }
  const vars = await envVars();
  const keys = Object.keys(vars);
  hint.textContent = I18nManager.t('envHintUsing').replace(
    '{vars}',
    keys.length ? keys.map((k) => `{{${k}}}`).join('  ') : I18nManager.t('envHintNoVars')
  );
}

function updateCollectionTarget() {
  const el = $('collectionTarget');
  if (!el) return;
  if (!state.selectedCollectionId) {
    el.textContent = I18nManager.t('collectionTargetNone');
    return;
  }
  const coll = collectionsManager.collections.find((c) => String(c.id) === String(state.selectedCollectionId));
  el.textContent = I18nManager.t('collectionTarget').replace('{name}', coll?.name || '').replace(
    '{folder}',
    state.selectedFolderId ? I18nManager.t('collectionTargetFolder') : ''
  );
}

async function envVars() {
  if (!state.isPro) return {};
  const id = $('environmentSelect').value;
  if (!id) return {};
  const env = await environmentsManager.getById(id);
  return { ...(env?.variables || {}) };
}

function authFeatureId(type) {
  if (type === 'oauth2') return 'oauth';
  if (type === 'apikey') return 'apikey';
  if (type === 'digest') return 'digest';
  return type;
}

function bodyFeatureId(type) {
  if (type === 'graphql') return 'graphql';
  return 'binary';
}

async function sendCurrent() {
  const tab = current();
  readFormIntoTab();
  if (isSocketMethod(tab.method)) {
    await connectSocket();
    return;
  }
  let url = tab.url.trim();
  if (!url) {
    UIHelpers.showToast(I18nManager.t('enterUrl'), 'error');
    return;
  }
  if (!state.isPro && !FREE_AUTH.has(tab.authType)) {
    requirePro(authFeatureId(tab.authType));
    return;
  }
  if (!state.isPro && !FREE_BODY.has(tab.bodyType)) {
    requirePro(bodyFeatureId(tab.bodyType));
    return;
  }
  const ctx = { variables: await envVars(), request: tab };
  if (state.isPro && tab.preRequest) {
    try {
      runPreRequest(tab.preRequest, ctx);
    } catch (e) {
      UIHelpers.showToast(`Pre-request: ${e.message}`, 'error');
      return;
    }
  }
  url = applyEnvVars(applyPathParams(applyParamsToUrl(url, tab.params), tab.pathParams), ctx.variables);
  if (!isHttpUrl(url)) {
    UIHelpers.showToast(I18nManager.t('invalidUrl'), 'error');
    return;
  }
  const headers = applyEnvToHeaders(
    Object.fromEntries((tab.headers || []).filter((h) => h.key && h.enabled !== false).map((h) => [h.key, h.value])),
    ctx.variables
  );
  if (tab.authType === 'bearer' && tab.auth.token) {
    headers.Authorization = `Bearer ${applyEnvVars(tab.auth.token, ctx.variables)}`;
  } else if (tab.authType === 'basic') {
    headers.Authorization = `Basic ${utf8ToBase64(`${tab.auth.user}:${tab.auth.pass}`)}`;
  } else if (tab.authType === 'apikey' && tab.auth.apiKeyName) {
    const value = applyEnvVars(tab.auth.apiKeyValue, ctx.variables);
    if (tab.auth.apiKeyIn === 'query') {
      const u = new URL(url);
      u.searchParams.set(tab.auth.apiKeyName, value);
      url = u.toString();
    } else headers[tab.auth.apiKeyName] = value;
  } else if (tab.authType === 'oauth2') {
    headers.Authorization = `Bearer ${await resolveOAuth(tab, ctx.variables)}`;
  }

  let body = applyEnvVars(tab.body, ctx.variables);
  let multipart = null;
  let binaryBody = null;
  if (tab.bodyType === 'json' || tab.bodyType === 'graphql') {
    try {
      JSON.parse(body || 'null');
    } catch {
      UIHelpers.showToast(I18nManager.t('invalidJson'), 'error');
      return;
    }
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  } else if (tab.bodyType === 'form') {
    headers['Content-Type'] = headers['Content-Type'] || 'application/x-www-form-urlencoded';
  } else if (tab.bodyType === 'multipart') {
    multipart = parseMultipartFields(body);
    for (const file of tab.files || []) multipart.push(file);
    delete headers['Content-Type'];
    body = null;
  } else if (tab.bodyType === 'binary' && tab.binary) {
    binaryBody = tab.binary;
    body = null;
  } else if (tab.bodyType === 'none') body = null;

  const requestId = newId();
  state.sendingId = requestId;
  $('sendBtn').hidden = true;
  $('cancelBtn').hidden = false;
  const payload = {
    method: tab.method,
    url,
    headers,
    body,
    timeout: state.timeout,
    multipart,
    binaryBody,
    requestId,
    followRedirects: tab.followRedirects,
    digest: tab.authType === 'digest' ? { username: tab.auth.user, password: tab.auth.pass } : null,
  };
  const response = await apiClient.sendRequest(payload);
  state.sendingId = null;
  $('sendBtn').hidden = false;
  $('cancelBtn').hidden = true;
  tab.response = response;
  tab.testResults = state.isPro ? runTests(tab.tests, response, ctx) : [];
  state.lastRequest = payload;
  renderResponse(tab);
  try {
    await historyManager.add(
      {
        method: tab.method,
        url,
        headers: sanitizeHeadersForStorage(tab.headers),
        body: tab.body,
        bodyType: tab.bodyType,
        authType: tab.authType,
        status: response.status,
        time: response.time,
        size: response.size,
        timestamp: Date.now(),
      },
      state.historyLimit
    );
    renderHistory();
    fillUrlHistory();
  } catch {}
  persistWorkspace();
}

async function resolveOAuth(tab, variables) {
  if (tab.auth.grant === 'authorization_code' && !tab.auth.token) {
    const launched = await launchAuthCode({
      authUrl: applyEnvVars(tab.auth.authUrl, variables),
      clientId: applyEnvVars(tab.auth.clientId, variables),
      scope: applyEnvVars(tab.auth.scope, variables),
    });
    const tokens = await exchangeCode({
      tokenUrl: applyEnvVars(tab.auth.tokenUrl, variables),
      clientId: applyEnvVars(tab.auth.clientId, variables),
      clientSecret: applyEnvVars(tab.auth.clientSecret, variables),
      code: launched.code,
      verifier: launched.verifier,
    });
    tab.auth.token = tokens.access_token;
    tab.auth.refresh = tokens.refresh_token || tab.auth.refresh;
    $('authToken').value = tab.auth.token;
  }
  if (!tab.auth.token && tab.auth.refresh) {
    const tokens = await refreshToken({
      tokenUrl: applyEnvVars(tab.auth.tokenUrl, variables),
      clientId: applyEnvVars(tab.auth.clientId, variables),
      clientSecret: applyEnvVars(tab.auth.clientSecret, variables),
      refresh: tab.auth.refresh,
    });
    tab.auth.token = tokens.access_token;
  }
  if (tab.auth.grant === 'client_credentials' && !tab.auth.token) {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: applyEnvVars(tab.auth.clientId, variables),
      client_secret: applyEnvVars(tab.auth.clientSecret, variables),
    });
    if (tab.auth.scope) body.set('scope', applyEnvVars(tab.auth.scope, variables));
    const res = await apiClient.sendRequest({
      method: 'POST',
      url: applyEnvVars(tab.auth.tokenUrl, variables),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      timeout: state.timeout,
    });
    const json = JSON.parse(res.body || '{}');
    if (!json.access_token) throw new Error('OAuth client credentials failed');
    tab.auth.token = json.access_token;
    tab.auth.refresh = json.refresh_token || '';
  }
  return tab.auth.token;
}

function renderResponse(tab) {
  const res = tab.response;
  const status = $('responseStatus');
  if (!res) {
    status.textContent = '—';
    $('responseBody').textContent = 'Send a request to see the response';
    return;
  }
  status.textContent = `${res.status} ${res.statusText || ''}`;
  status.className = `badge ${res.ok ? 'ok' : 'bad'}`;
  $('responseTime').textContent = res.timings ? `${res.timings.total}ms` : `${res.time || 0}ms`;
  $('responseSize').textContent = UIHelpers.formatSize(res.size || 0);
  $('responseTtfb').textContent = res.timings ? `TTFB ${res.timings.ttfb}ms · dl ${res.timings.download}ms` : '';
  $('responseBody').textContent = res.body || res.error || '';
  try {
    $('responsePretty').innerHTML = highlightJson(formatJson(res.body));
  } catch {
    try {
      $('responsePretty').textContent = prettyXml(res.body);
    } catch {
      $('responsePretty').textContent = res.body || '';
    }
  }
  $('responseHeaders').textContent = JSON.stringify(res.headers || {}, null, 2);
  $('responseRedirects').textContent = JSON.stringify(res.redirects || [], null, 2);
  $('respHint').textContent = hintForResponse(res);
  const iframe = $('responsePreview');
  const ct = res.headers?.['content-type'] || res.contentType || '';
  if (ct.includes('text/html') && !res.truncated) {
    iframe.srcdoc = res.body;
    iframe.classList.remove('hidden');
  } else {
    iframe.removeAttribute('srcdoc');
  }
  const tests = $('testResults');
  tests.replaceChildren();
  (tab.testResults || []).forEach((t) => {
    const div = document.createElement('div');
    div.className = `test-item ${t.pass ? 'pass' : 'fail'}`;
    div.textContent = `${t.pass ? 'PASS' : 'FAIL'} ${t.name}${t.error ? ` — ${t.error}` : ''}`;
    tests.appendChild(div);
  });
  const diff = $('diffView');
  diff.replaceChildren();
  if (tab.snapshot) {
    diffText(tab.snapshot, res.body || '').forEach((row) => {
      const line = document.createElement('div');
      line.className = `diff-row${row.changed ? ' changed' : ''}`;
      line.textContent = `${row.line}: ${row.right}`;
      diff.appendChild(line);
    });
  } else {
    diff.textContent = 'Save a snapshot first';
  }
}

function showPane(name) {
  document.querySelectorAll('.subpane').forEach((p) => p.classList.toggle('active', p.id === `pane-${name}`));
  document.querySelectorAll('#reqSubtabs button').forEach((b) => b.classList.toggle('active', b.dataset.pane === name));
}

function showResp(name) {
  const map = {
    body: 'responseBody',
    pretty: 'responsePretty',
    headers: 'responseHeaders',
    preview: 'responsePreview',
    redirects: 'responseRedirects',
    tests: 'testResults',
    diff: 'diffView',
    filter: 'pane-filter',
  };
  Object.values(map).forEach((id) => $(id)?.classList.add('hidden'));
  $(map[name])?.classList.remove('hidden');
  document.querySelectorAll('#respSubtabs button').forEach((b) => b.classList.toggle('active', b.dataset.rpane === name));
}

function hideTreeMenu() {
  $('treeMenu')?.classList.add('hidden');
  state.treeMenuTarget = null;
}

function showTreeMenu(event, target) {
  const menu = $('treeMenu');
  if (!menu) return;
  event.preventDefault();
  event.stopPropagation();
  state.treeMenuTarget = target;
  menu.classList.remove('hidden');
  menu.style.left = `${Math.min(event.clientX, window.innerWidth - 170)}px`;
  menu.style.top = `${Math.min(event.clientY, window.innerHeight - 90)}px`;
}

function markTreeSelection(el) {
  document.querySelectorAll('#collectionTree .tree-item.selected').forEach((node) => node.classList.remove('selected'));
  el?.classList.add('selected');
  updateCollectionTarget();
}

function renderCollections() {
  const tree = $('collectionTree');
  tree.replaceChildren();
  const q = $('sidebarSearch').value.toLowerCase();
  if (!collectionsManager.collections.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-hint';
    empty.textContent = I18nManager.t('collectionsEmpty');
    tree.appendChild(empty);
    updateCollectionTarget();
    return;
  }
  collectionsManager.collections.forEach((coll) => {
    const wrap = document.createElement('div');
    const title = document.createElement('div');
    title.className = `tree-item${String(state.selectedCollectionId) === String(coll.id) && !state.selectedFolderId ? ' selected' : ''}`;
    title.textContent = coll.name;
    title.title = I18nManager.t('collectionDblHint');
    title.onclick = () => {
      state.selectedCollectionId = coll.id;
      state.selectedFolderId = null;
      markTreeSelection(title);
    };
    title.ondblclick = (e) => showTreeMenu(e, { kind: 'collection', coll });
    wrap.appendChild(title);
    const draw = (items, pad) => {
      (items || []).forEach((item) => {
        if (item.type === 'folder') {
          const f = document.createElement('div');
          f.className = `tree-item${String(state.selectedFolderId) === String(item.id) ? ' selected' : ''}`;
          f.style.paddingLeft = `${pad}px`;
          f.textContent = `▸ ${item.name}`;
          f.title = I18nManager.t('collectionDblHint');
          f.onclick = () => {
            state.selectedCollectionId = coll.id;
            state.selectedFolderId = item.id;
            markTreeSelection(f);
          };
          f.ondblclick = (e) => showTreeMenu(e, { kind: 'folder', coll, item });
          wrap.appendChild(f);
          draw(item.items, pad + 12);
        } else if (!q || `${item.name} ${item.url}`.toLowerCase().includes(q)) {
          const r = document.createElement('div');
          const isOpen = Boolean(findOpenCollectionTab(coll.id, item.id));
          r.className = `tree-item${isOpen ? ' open-req' : ''}`;
          r.style.paddingLeft = `${pad}px`;
          r.title = I18nManager.t('collectionOpenHint');
          const m = document.createElement('span');
          m.className = `method ${item.method || 'GET'}`;
          m.textContent = item.method || 'GET';
          r.append(m, document.createTextNode(` ${item.name || item.url || 'request'}`));
          r.onclick = () => {
            state.selectedCollectionId = coll.id;
            openTab({ ...item, collectionId: coll.id, collectionItemId: item.id });
          };
          wrap.appendChild(r);
        }
      });
    };
    draw(coll.items, 12);
    tree.appendChild(wrap);
  });
  updateCollectionTarget();
}

function renderHistory() {
  const box = $('historyList');
  box.replaceChildren();
  historyManager.getItems(state.historyLimit).forEach((item) => {
    const div = document.createElement('div');
    div.className = 'history-item';
    const m = document.createElement('span');
    m.className = `method ${item.method}`;
    m.textContent = item.method;
    div.append(m, document.createTextNode(item.url || ''));
    div.onclick = () => openTab(item);
    box.appendChild(div);
  });
}

function fillUrlHistory() {
  $('urlHistory').replaceChildren();
  [...new Set(historyManager.getAll().map((h) => h.url).filter(Boolean))].slice(0, 30).forEach((url) => {
    const o = document.createElement('option');
    o.value = url;
    $('urlHistory').appendChild(o);
  });
}

async function renderEnvs() {
  const select = $('environmentSelect');
  const selected = select.value;
  select.replaceChildren();
  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = I18nManager.t('noEnvironment');
  select.appendChild(empty);
  (await environmentsManager.getAll()).forEach((env) => {
    const o = document.createElement('option');
    o.value = env.id;
    o.textContent = env.name;
    select.appendChild(o);
  });
  if (selected) select.value = selected;
  await updateEnvHint();
}

function collectEnvCard(card) {
  const variables = {};
  const secrets = {};
  [...card.querySelectorAll('.kv-row')].forEach((row) => {
    const key = row.querySelector('.env-key')?.value.trim();
    if (!key) return;
    variables[key] = row.querySelector('.env-val')?.value || '';
    if (row.querySelector('.env-secret')?.checked) secrets[key] = true;
  });
  return { variables, secrets };
}

function renderEnvEditor() {
  const box = $('envEditor');
  box.replaceChildren();
  if (!environmentsManager.environments.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-hint';
    empty.textContent = I18nManager.t('environmentsEmpty');
    box.appendChild(empty);
    return;
  }
  environmentsManager.environments.forEach((env) => {
    const card = document.createElement('div');
    card.className = 'env-card';
    const head = document.createElement('div');
    head.className = 'row env-card-head';
    const h = document.createElement('h4');
    h.textContent = env.name;
    const delEnv = document.createElement('button');
    delEnv.className = 'btn small danger';
    delEnv.textContent = I18nManager.t('envDeleteEnv');
    delEnv.onclick = async () => {
      await environmentsManager.delete(env.id);
      if ($('environmentSelect').value === String(env.id)) {
        $('environmentSelect').value = '';
        await storage.set('active_env_id', null);
      }
      await renderEnvs();
      renderEnvEditor();
    };
    head.append(h, delEnv);
    card.appendChild(head);

    const vars = Object.entries(env.variables || {});
    if (!vars.length) {
      const none = document.createElement('p');
      none.className = 'hint';
      none.textContent = I18nManager.t('envHintNoVars');
      card.appendChild(none);
    }

    const persist = () => {
      Object.assign(env, collectEnvCard(card));
      environmentsManager.update(env.id, env).then(updateEnvHint);
    };

    vars.forEach(([key, value]) => {
      const row = document.createElement('div');
      row.className = 'kv-row';
      const k = document.createElement('input');
      k.className = 'env-key';
      k.placeholder = I18nManager.t('envKeyPlaceholder');
      k.value = key;
      const v = document.createElement('input');
      v.className = 'env-val';
      v.placeholder = I18nManager.t('envValuePlaceholder');
      v.type = env.secrets?.[key] ? 'password' : 'text';
      v.value = value;
      const secWrap = document.createElement('label');
      secWrap.className = 'secret-lab';
      const sec = document.createElement('input');
      sec.type = 'checkbox';
      sec.className = 'env-secret';
      sec.checked = Boolean(env.secrets?.[key]);
      secWrap.append(sec, document.createTextNode(I18nManager.t('envSecret')));
      const delVar = document.createElement('button');
      delVar.className = 'btn small';
      delVar.type = 'button';
      delVar.title = I18nManager.t('envDeleteVar');
      delVar.setAttribute('aria-label', I18nManager.t('envDeleteVar'));
      delVar.textContent = '×';
      delVar.onclick = () => {
        row.remove();
        persist();
        renderEnvEditor();
      };
      k.onchange = persist;
      v.onchange = persist;
      sec.onchange = () => {
        v.type = sec.checked ? 'password' : 'text';
        persist();
      };
      row.append(k, v, secWrap, delVar);
      card.appendChild(row);
    });

    const add = document.createElement('button');
    add.className = 'btn small';
    add.textContent = I18nManager.t('envAddVar');
    add.onclick = () => {
      Object.assign(env, collectEnvCard(card));
      env.variables = env.variables || {};
      let n = 1;
      while (Object.prototype.hasOwnProperty.call(env.variables, `key${n}`)) n += 1;
      env.variables[`key${n}`] = '';
      environmentsManager.update(env.id, env).then(renderEnvEditor);
    };
    card.appendChild(add);
    box.appendChild(card);
  });
}

function paletteItems() {
  const commands = [
    { label: I18nManager.t('cmdSend'), run: sendCurrent },
    { label: I18nManager.t('cmdNewTab'), run: () => openTab() },
    { label: I18nManager.t('cmdFormatJson'), run: () => formatBody() },
    {
      label: I18nManager.t('cmdOpenEnv'),
      run: () => {
        if (!requirePro('environments')) return;
        $('envModal').classList.remove('hidden');
      },
    },
    { label: I18nManager.t('cmdOpenSettings'), run: () => $('settingsModal').classList.remove('hidden') },
    {
      label: I18nManager.t('cmdWebsocket'),
      run: () => openSocketWorkspace(),
    },
  ];
  searchRequests(collectionsManager.collections, $('paletteInput').value).forEach((hit) => {
    commands.push({
      label: `${hit.request.method} ${hit.request.name || hit.request.url}`,
      run: () => {
        if (!requirePro('collections')) return;
        openTab({ ...hit.request, collectionId: hit.collection.id, collectionItemId: hit.request.id });
      },
    });
  });
  return commands.filter((c) => c.label.toLowerCase().includes(($('paletteInput').value || '').toLowerCase()));
}

function renderPalette() {
  const list = $('paletteList');
  list.replaceChildren();
  paletteItems().forEach((item) => {
    const div = document.createElement('div');
    div.className = 'palette-item';
    div.textContent = item.label;
    div.onclick = () => {
      $('palette').classList.add('hidden');
      item.run();
    };
    list.appendChild(div);
  });
}

function formatBody() {
  try {
    $('bodyEditor').value = formatJson($('bodyEditor').value);
    $('jsonError').textContent = '';
  } catch (e) {
    $('jsonError').textContent = e.message;
  }
}

function generateCode() {
  if (!requirePro('codegen')) return;
  readFormIntoTab();
  const tab = current();
  const headers = Object.fromEntries((tab.headers || []).filter((h) => h.key).map((h) => [h.key, h.value]));
  $('codeOutput').textContent = CodeGenerator.generate(tab.method, tab.url, headers, tab.body, $('codeLanguage').value);
}

async function runCollection() {
  if (!requirePro('collectionRun')) return;
  const id = state.selectedCollectionId;
  if (!id) {
    UIHelpers.showToast('Select a collection in the sidebar', 'error');
    return;
  }
  const reqs = collectionsManager.flatten(id);
  $('runModal').classList.remove('hidden');
  const report = $('runReport');
  report.replaceChildren();
  for (const req of reqs) {
    openTab({ ...req, collectionId: id, collectionItemId: req.id });
    writeTabToForm();
    await sendCurrent();
    const tab = current();
    const line = document.createElement('div');
    const failed = !tab.response?.ok || (tab.testResults || []).some((t) => !t.pass);
    line.className = failed ? 'fail' : 'pass';
    line.textContent = `${tab.method} ${tab.url} → ${tab.response?.status} tests ${(tab.testResults || []).filter((t) => t.pass).length}/${(tab.testResults || []).length}`;
    report.appendChild(line);
    if (failed && $('stopOnFail').checked) break;
  }
}

function fileToBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const data = reader.result.split(',')[1];
      resolve({ fileName: file.name, fileType: file.type, fileBase64: data, name: file.name });
    };
    reader.readAsDataURL(file);
  });
}

async function init() {
  const isPanel = new URLSearchParams(location.search).get('mode') === 'panel' || window.innerWidth < 720;
  if (isPanel) document.body.classList.add('is-panel', 'sidebar-collapsed');
  const syncStack = () => document.body.classList.toggle('stacked', window.innerWidth < 1100);
  syncStack();
  window.addEventListener('resize', syncStack);

  await I18nManager.init();
  await themeManager.init();
  document.documentElement.setAttribute('data-theme', themeManager.isDark() ? 'dark' : 'light');
  await collectionsManager.load();
  await environmentsManager.load();
  await historyManager.load();
  const proStored = await chrome.storage.local.get(['isPro']);
  state.isPro = Boolean(proStored.isPro);
  $('proToggle').checked = state.isPro;
  const settings = (await storage.get('app_settings', {})) || {};
  state.timeout = settings.timeout || 30000;
  const cap = historyLimitFor(state.isPro);
  state.historyLimit = settings.historyMax ? Math.min(cap, Number(settings.historyMax) || cap) : cap;
  const saved = (await storage.get('workspace_tabs', null)) || {};
  if (saved.tabs?.length) {
    state.tabs = saved.tabs.map((t) => tabFromDraft(t));
    state.activeId = saved.activeId || state.tabs[0].id;
  } else {
    openTab();
  }
  CodeGenerator.getLanguages().forEach((lang) => {
    const o = document.createElement('option');
    o.value = lang;
    o.textContent = CodeGenerator.getLanguageLabel(lang);
    $('codeLanguage').appendChild(o);
  });
  applyProUi();
  if ($('settingsTimeout')) $('settingsTimeout').value = String(state.timeout);
  if ($('settingsHistoryMax')) $('settingsHistoryMax').value = String(state.historyLimit);
  renderCollections();
  renderHistory();
  fillUrlHistory();
  await renderEnvs();
  const activeEnv = await storage.get('active_env_id', null);
  if (activeEnv && state.isPro) $('environmentSelect').value = String(activeEnv);
  writeTabToForm();
  syncWorkspaceMode();
  await updateEnvHint();
}

$('sendBtn').onclick = sendCurrent;
$('cancelBtn').onclick = () => apiClient.cancel(state.sendingId);
$('repeatBtn').onclick = sendCurrent;
$('reqName').oninput = () => {
  const tab = current();
  if (!tab) return;
  tab.name = $('reqName').value.trim();
  const chip = document.querySelector('.tab-chip.active .tab-chip-name');
  if (chip) chip.textContent = tab.name || I18nManager.t('defaultRequestName');
  scheduleCollectionSync();
};
$('reqName').onblur = () => {
  const tab = current();
  if (!tab) return;
  if (!tab.name) {
    tab.name = I18nManager.t('defaultRequestName');
    $('reqName').value = tab.name;
    const chip = document.querySelector('.tab-chip.active .tab-chip-name');
    if (chip) chip.textContent = tab.name;
  }
  persistWorkspace();
};
$('reqName').onkeydown = (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    $('reqName').blur();
  }
};
$('authType').onchange = () => {
  const type = $('authType').value;
  if (!FREE_AUTH.has(type) && !requirePro(authFeatureId(type))) {
    $('authType').value = current()?.authType && FREE_AUTH.has(current().authType) ? current().authType : 'none';
  }
  toggleAuth();
};
$('bodyType').onchange = () => {
  const type = $('bodyType').value;
  if (!FREE_BODY.has(type) && !requirePro(bodyFeatureId(type))) {
    $('bodyType').value = 'json';
  }
};
$('environmentSelect').onchange = async () => {
  if ($('environmentSelect').value && !requirePro('environments')) {
    $('environmentSelect').value = '';
    return;
  }
  await storage.set('active_env_id', $('environmentSelect').value || null);
  await updateEnvHint();
};
$('methodSelect').onchange = () => {
  const method = $('methodSelect').value;
  if (isSocketMethod(method) && !requirePro('websocket')) {
    $('methodSelect').value = isSocketMethod(current()?.method) ? 'GET' : (current()?.method || 'GET');
    return;
  }
  if (current()) current().method = method;
  closeSocket(true);
  syncWorkspaceMode();
  scheduleCollectionSync();
};
$('addQueryBtn').onclick = () => {
  current().params.push({ key: '', value: '', enabled: true });
  renderKvs();
};
$('addPathBtn').onclick = () => {
  current().pathParams.push({ key: '', value: '', enabled: true });
  renderKvs();
};
$('addHeaderBtn').onclick = () => {
  current().headers.push({ key: '', value: '', enabled: true });
  renderKvs();
};
$('addCommonHeadersBtn').onclick = () => {
  [['Accept', 'application/json'], ['Content-Type', 'application/json']].forEach(([key, value]) => {
    if (!current().headers.find((h) => h.key === key)) current().headers.push({ key, value, enabled: true });
  });
  renderKvs();
};
$('urlInput').oninput = debounce(() => {
  const tab = current();
  tab.url = $('urlInput').value;
  tab.params = parseUrlParams(tab.url);
  renderKvs();
  updateEnvHint();
  scheduleCollectionSync();
}, 200);
$('bodyEditor').oninput = () => {
  if ($('bodyType').value === 'json') $('jsonError').textContent = jsonError($('bodyEditor').value) || '';
  const tab = current();
  if (tab) tab.body = $('bodyEditor').value;
  scheduleCollectionSync();
};
$('formatJsonBtn').onclick = formatBody;
$('minifyJsonBtn').onclick = () => {
  try {
    $('bodyEditor').value = minifyJson($('bodyEditor').value);
  } catch (e) {
    $('jsonError').textContent = e.message;
  }
};
$('pickBinaryBtn').onclick = () => {
  if (!requirePro('binary')) return;
  $('binaryFile').click();
};
$('binaryFile').onchange = async (e) => {
  if (!requirePro('binary')) return;
  const file = e.target.files[0];
  if (!file) return;
  current().binary = await fileToBase64(file);
  current().binary.name = 'file';
  UIHelpers.showToast(`Binary ${file.name}`, 'success');
};
$('multiFiles').onchange = async (e) => {
  if (!requirePro('binary')) {
    e.target.value = '';
    return;
  }
  current().files = [];
  for (const file of [...e.target.files]) {
    const encoded = await fileToBase64(file);
    encoded.name = file.name;
    current().files.push(encoded);
  }
};
$('reqSubtabs').onclick = (e) => {
  const pane = e.target.dataset.pane;
  if (!pane) return;
  const feature = e.target.dataset.pro;
  if (feature && !requirePro(feature)) return;
  showPane(pane);
};
$('respSubtabs').onclick = (e) => {
  const pane = e.target.dataset.rpane;
  if (!pane) return;
  const feature = e.target.dataset.pro;
  if (feature && !requirePro(feature)) return;
  showResp(pane);
};
$('copyResponseBtn').onclick = () => navigator.clipboard.writeText($('responseBody').textContent);
$('saveResponseBtn').onclick = () => UIHelpers.downloadText(`response_${Date.now()}.json`, $('responseBody').textContent);
$('snapshotBtn').onclick = () => {
  current().snapshot = current().response?.body || '';
  UIHelpers.showToast('Snapshot saved', 'success');
};
$('copyAsCurlBtn').onclick = () => {
  readFormIntoTab();
  const tab = current();
  navigator.clipboard.writeText(CurlParser.stringify(tab.method, tab.url, tab.headers, tab.body));
};
$('parseCurlBtn').onclick = () => {
  const parsed = CurlParser.parse($('curlInput').value);
  openTab({ ...parsed, name: parsed.url });
};
$('exportCurlBtn').onclick = () => $('copyAsCurlBtn').click();
$('codeLanguage').onchange = generateCode;
$('copyCodeBtn').onclick = () => {
  generateCode();
  navigator.clipboard.writeText($('codeOutput').textContent);
};
$('gqlPlayBtn').onclick = async () => {
  try {
    const q = GraphQLManager.formatQuery($('graphqlQuery').value);
    const vars = GraphQLManager.parseVariables($('graphqlVariables').value);
    $('bodyType').value = 'json';
    $('methodSelect').value = 'POST';
    $('bodyEditor').value = GraphQLManager.buildPayload(q, vars);
    await sendCurrent();
  } catch (error) {
    UIHelpers.showToast(error.message, 'error');
  }
};
$('gqlIntroBtn').onclick = async () => {
  readFormIntoTab();
  state.gqlSchema = await introspect($('urlInput').value);
  $('gqlSchema').textContent = (state.gqlSchema.types || []).map((t) => t.name).join('\n');
};
$('graphqlQuery').oninput = debounce(() => {
  const word = ($('graphqlQuery').value.match(/[A-Za-z_]+$/) || [''])[0];
  $('gqlSuggest').textContent = suggestGraphql(state.gqlSchema, word)
    .map((f) => `${f.name} (${f.type})`)
    .join(' · ');
}, 150);
$('loadCookiesBtn').onclick = async () => {
  const res = await chrome.runtime.sendMessage({ type: 'getCookies', url: $('urlInput').value });
  $('cookieList').textContent = JSON.stringify(res.cookies || [], null, 2);
};
$('setCookieBtn').onclick = async () => {
  const url = $('urlInput').value;
  await chrome.runtime.sendMessage({
    type: 'setCookie',
    details: { url, name: $('cookieName').value, value: $('cookieValue').value },
  });
  $('loadCookiesBtn').click();
};
$('jsonPath').oninput = () => {
  try {
    $('jsonPathOut').textContent = JSON.stringify(queryJsonPath(current().response?.body || '{}', $('jsonPath').value), null, 2);
  } catch (e) {
    $('jsonPathOut').textContent = e.message;
  }
};
$('newCollectionBtn').onclick = async () => {
  if (!requirePro('collections')) return;
  const name = $('newCollectionName').value.trim() || I18nManager.t('defaultCollectionName');
  const created = await collectionsManager.create(name);
  state.selectedCollectionId = created.id;
  state.selectedFolderId = null;
  $('newCollectionName').value = '';
  renderCollections();
  UIHelpers.showToast(I18nManager.t('collectionCreated'), 'success');
};
$('newFolderBtn').onclick = async () => {
  if (!requirePro('collections')) return;
  if (!state.selectedCollectionId) return UIHelpers.showToast(I18nManager.t('collectionSelectFirst'), 'error');
  const name = prompt(I18nManager.t('newFolderBtn'), I18nManager.t('defaultFolderName'));
  if (name) {
    await collectionsManager.addFolder(state.selectedCollectionId, name, state.selectedFolderId);
    renderCollections();
  }
};
$('importAnyBtn').onclick = () => $('importFile').click();
$('importFile').onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const imported = detectAndImport(text);
    await collectionsManager.importMany(imported);
    renderCollections();
    UIHelpers.showToast(I18nManager.t('importedOk'), 'success');
  } catch (err) {
    UIHelpers.showToast(err.message || I18nManager.t('importFailed'), 'error');
  }
  e.target.value = '';
};
$('exportCollectionBtn').onclick = async () => {
  if (!requirePro('importCollections')) return;
  const selected = state.selectedCollectionId
    ? await collectionsManager.exportCollection(state.selectedCollectionId)
    : null;
  const payload = selected
    ? { format: 'pingto', version: 1, collections: [selected] }
    : { format: 'pingto', version: 1, collections: await collectionsManager.exportAll() };
  const filename = selected ? `${selected.name || 'collection'}.json` : 'pingto-collections.json';
  UIHelpers.downloadText(filename, JSON.stringify(payload, null, 2), 'application/json');
};
$('saveToCollectionBtn').onclick = async () => {
  if (!requirePro('collections')) return;
  readFormIntoTab();
  const tab = current();
  if (!state.selectedCollectionId) {
    const created = await collectionsManager.create($('newCollectionName').value.trim() || I18nManager.t('defaultCollectionName'));
    state.selectedCollectionId = created.id;
    $('newCollectionName').value = '';
  }
  if (tab.collectionId && tab.collectionItemId && String(tab.collectionId) === String(state.selectedCollectionId)) {
    await collectionsManager.updateRequest(tab.collectionId, tab.collectionItemId, collectionRequestPayload(tab));
  } else {
    const saved = await collectionsManager.addRequest(
      state.selectedCollectionId,
      collectionRequestPayload({ ...tab, collectionItemId: tab.collectionItemId || newId() }),
      state.selectedFolderId
    );
    tab.collectionId = state.selectedCollectionId;
    tab.collectionItemId = saved.id;
  }
  persistWorkspace();
  renderCollections();
  UIHelpers.showToast(I18nManager.t('requestSaved'), 'success');
};
$('duplicateBtn').onclick = () => {
  readFormIntoTab();
  openTab({
    ...current(),
    name: `${current().name} copy`,
    id: undefined,
    collectionId: null,
    collectionItemId: null,
  });
};
$('runCollectionBtn').onclick = runCollection;
$('exportBruBtn').onclick = async () => {
  const coll = await collectionsManager.getById(state.selectedCollectionId);
  if (!coll) return UIHelpers.showToast('Select a collection', 'error');
  downloadBruZipLike(sanitizeExport(coll));
};
$('editEnvBtn').onclick = () => {
  if (!requirePro('environments')) return;
  renderEnvEditor();
  $('envModal').classList.remove('hidden');
};
$('createEnvBtn').onclick = async () => {
  if (!requirePro('environments')) return;
  const name = $('newEnvName').value.trim();
  if (!name) {
    UIHelpers.showToast(I18nManager.t('envNeedName'), 'error');
    return;
  }
  const env = await environmentsManager.create(name, { base_url: 'https://api.example.com' });
  $('newEnvName').value = '';
  await renderEnvs();
  $('environmentSelect').value = String(env.id);
  await storage.set('active_env_id', env.id);
  renderEnvEditor();
  await updateEnvHint();
  UIHelpers.showToast(I18nManager.t('envCreated'), 'success');
};
$('closeEnvBtn').onclick = () => $('envModal').classList.add('hidden');
$('settingsBtn').onclick = () => $('settingsModal').classList.remove('hidden');
$('closeSettingsBtn').onclick = () => $('settingsModal').classList.add('hidden');
$('saveSettingsBtn').onclick = async () => {
  state.timeout = Number($('settingsTimeout').value) || 30000;
  let requested = Number($('settingsHistoryMax').value) || FREE_HISTORY_LIMIT;
  const cap = historyLimitFor(state.isPro);
  if (requested > cap) {
    if (!state.isPro) requirePro('historyCap');
    requested = cap;
    $('settingsHistoryMax').value = String(cap);
  }
  state.historyLimit = requested;
  await storage.set('app_settings', { timeout: state.timeout, historyMax: state.historyLimit });
  $('settingsModal').classList.add('hidden');
};
$('closeRunBtn').onclick = () => $('runModal').classList.add('hidden');
$('themeToggle').onclick = () => {
  themeManager.toggle();
  document.documentElement.setAttribute('data-theme', themeManager.isDark() ? 'dark' : 'light');
};
$('languageToggle').onclick = async () => {
  await I18nManager.toggle();
  await renderEnvs();
};
document.addEventListener('languageChanged', async () => {
  I18nManager.apply();
  applyProUi();
  await renderEnvs();
});
$('openTabBtn').onclick = () => chrome.runtime.sendMessage({ type: 'openFullscreen' });
$('sidebarToggle').onclick = () => document.body.classList.toggle('sidebar-collapsed');
$('wsBtn').onclick = () => openSocketWorkspace();
$('wsConnectBtn').onclick = () => connectSocket();
$('wsDisconnectBtn').onclick = () => closeSocket(true);
$('wsSendBtn').onclick = sendWsMessage;
$('wsMessageInput').onkeydown = (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendWsMessage();
  }
};
$('proToggle').onchange = () => setPro($('proToggle').checked);
$('proEnableBtn').onclick = async () => {
  await setPro(true);
  $('proModal').classList.add('hidden');
};
$('closeProModal').onclick = () => $('proModal').classList.add('hidden');
document.addEventListener('click', (e) => {
  if (state.isPro) return;
  const el = e.target.closest('[data-pro]');
  if (!el || el.tagName === 'OPTION' || el.tagName === 'SELECT' || el.tagName === 'INPUT') return;
  if (el.closest('#proModal')) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  requirePro(el.dataset.pro);
}, true);
$('collectionTree').addEventListener('click', (e) => {
  if (state.isPro) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  requirePro('collections');
}, true);
$('paletteBtn').onclick = () => {
  $('palette').classList.remove('hidden');
  $('paletteInput').focus();
  renderPalette();
};
$('paletteInput').oninput = renderPalette;
$('sidebarSearch').oninput = debounce(renderCollections, 150);
$('oauthLoginBtn').onclick = async () => {
  if (!requirePro('oauth')) return;
  readFormIntoTab();
  const token = await resolveOAuth(current(), await envVars());
  $('authToken').value = token || '';
  UIHelpers.showToast('Token ready', 'success');
};

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    sendCurrent();
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    $('palette').classList.toggle('hidden');
    $('paletteInput').focus();
    renderPalette();
  }
  if (e.key === 'Escape') {
    $('palette').classList.add('hidden');
    $('envModal').classList.add('hidden');
    $('settingsModal').classList.add('hidden');
    $('proModal').classList.add('hidden');
    hideTreeMenu();
  }
});
document.addEventListener('click', (e) => {
  if (!$('treeMenu') || $('treeMenu').classList.contains('hidden')) return;
  if (e.target.closest('#treeMenu')) return;
  hideTreeMenu();
});
$('treeMenuRename').onclick = async () => {
  const target = state.treeMenuTarget;
  hideTreeMenu();
  if (!target) return;
  const currentName = target.kind === 'collection' ? target.coll.name : target.item.name;
  const name = prompt(I18nManager.t('renameBtn'), currentName);
  if (!name || !name.trim()) return;
  if (target.kind === 'collection') await collectionsManager.rename(target.coll.id, name.trim());
  else await collectionsManager.renameItem(target.coll.id, target.item.id, name.trim());
  renderCollections();
};
$('treeMenuDelete').onclick = async () => {
  const target = state.treeMenuTarget;
  hideTreeMenu();
  if (!target) return;
  const label = target.kind === 'collection' ? target.coll.name : target.item.name;
  if (!confirm(I18nManager.t('confirmDelete').replace('{name}', label))) return;
  if (target.kind === 'collection') {
    await collectionsManager.delete(target.coll.id);
    state.tabs.forEach((tab) => {
      if (String(tab.collectionId) === String(target.coll.id)) {
        tab.collectionId = null;
        tab.collectionItemId = null;
      }
    });
    if (String(state.selectedCollectionId) === String(target.coll.id)) {
      state.selectedCollectionId = null;
      state.selectedFolderId = null;
    }
  } else {
    await collectionsManager.removeItem(target.coll.id, target.item.id);
    state.tabs.forEach((tab) => {
      if (String(tab.collectionItemId) === String(target.item.id)) {
        tab.collectionId = null;
        tab.collectionItemId = null;
      }
    });
  }
  persistWorkspace();
  renderCollections();
};

chrome.commands?.onCommand.addListener((c) => {
  if (c === 'send-request') sendCurrent();
});

$('responseStatus').onclick = () => navigator.clipboard.writeText($('responseStatus').textContent);
$('responseTime').onclick = () => navigator.clipboard.writeText($('responseTime').textContent);
$('responseSize').onclick = () => navigator.clipboard.writeText($('responseSize').textContent);

init();
