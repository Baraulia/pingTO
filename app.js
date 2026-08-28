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
import { importAs } from './modules/importers.js';
import { toBrunoText, toInsomnia, toPingto, toPostman } from './modules/exporters.js';
import { exchangeCode, launchAuthCode, refreshToken } from './modules/oauth.js';
import { runPreRequest, runTests } from './modules/sandbox.js';
import {
  checkLoadAgent,
  clampLoadSpec,
  DEFAULT_LOADTEST_AGENT,
  formatLoadReport,
  formatMs,
  httpTone,
  loadProgressPct,
  mixShares,
  parseAmmoJson,
  parseCompensate,
  buildLoadReportHtml,
  pushLoadSample,
  sparklinePoints,
  startLoadRun,
  stopLoadRun,
  subscribeLoadRun,
} from './modules/loadtest-client.js';
import {
  compareVersions,
  DEFAULT_LOADTEST_MANIFEST_URL,
  detectLoadAgentPlatformAsync,
  fetchLoadManifest,
  LOAD_AGENT_PLATFORMS,
  mergeLoadManifest,
  normalizeLoadManifest,
  verifyCommand,
} from './modules/loadtest-release.js';
import {
  emptyRequest,
  findItem,
  findParentId,
  flattenRequests,
  newId,
  searchRequests,
} from './modules/collection-tree.js';
import { introspect, suggestGraphql } from './modules/graphql-schema.js';
import {
  FREE_AUTH,
  FREE_BODY,
  FREE_COLLECTION_LIMIT,
  FREE_HISTORY_LIMIT,
  FREE_REQ_PANES,
  FREE_RESP_PANES,
  canAddCollection,
  canAddEnvVar,
  canAddEnvironment,
  canAddRequest,
  historyLimitFor,
  isCollectionUnlocked,
  PRO_FEATURES,
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
  expandedCollectionId: null,
  treeMenuTarget: null,
};

const socketSession = { ws: null, sse: null, reconnectTimer: null, manualClose: false };

const ENV_SELECT_NEW = '__env_new__';
const ENV_SELECT_MANAGE = '__env_manage__';

function isEnvSelectAction(value) {
  return value === ENV_SELECT_NEW || value === ENV_SELECT_MANAGE;
}

function activateCollection(id, folderId = null, expand = true) {
  state.selectedCollectionId = id;
  state.selectedFolderId = folderId;
  if (expand) state.expandedCollectionId = id;
}

function isSocketMethod(method) {
  return method === 'WS' || method === 'SSE';
}

function featureName(id) {
  const key = PRO_FEATURES[id];
  return key ? I18nManager.t(key) : id;
}

const PRO_MODAL_ITEMS = [
  { id: 'historyCap', titleKey: 'proItemHistoryTitle', descKey: 'proItemHistoryDesc' },
  { id: 'collections', titleKey: 'proItemCollectionsTitle', descKey: 'proItemCollectionsDesc' },
  { id: 'importCollections', titleKey: 'proItemImportTitle', descKey: 'proItemImportDesc' },
  { id: 'collectionRun', titleKey: 'proItemRunTitle', descKey: 'proItemRunDesc' },
  { id: 'graphql', titleKey: 'proItemGraphqlTitle', descKey: 'proItemGraphqlDesc' },
  { id: 'websocket', titleKey: 'proItemWebsocketTitle', descKey: 'proItemWebsocketDesc' },
  { id: 'digest', titleKey: 'proItemDigestTitle', descKey: 'proItemDigestDesc' },
  { id: 'oauth', titleKey: 'proItemOauthTitle', descKey: 'proItemOauthDesc' },
  { id: 'binary', titleKey: 'proItemBinaryTitle', descKey: 'proItemBinaryDesc' },
  { id: 'scripts', titleKey: 'proItemScriptsTitle', descKey: 'proItemScriptsDesc' },
  { id: 'testsResp', titleKey: 'proItemTestsTitle', descKey: 'proItemTestsDesc' },
  { id: 'codegen', titleKey: 'proItemCodegenTitle', descKey: 'proItemCodegenDesc' },
  { id: 'loadtest', titleKey: 'proItemLoadtestTitle', descKey: 'proItemLoadtestDesc' },
];

const PRO_MODAL_HIGHLIGHT = {
  snapshots: 'testsResp',
  diff: 'testsResp',
  bruno: 'importCollections',
};

let lastProFeatureId = null;
let loadUnsub = null;
let loadRunId = null;
let lastLoadReport = null;
let loadHistory = [];
let loadManifest = null;
let loadPlatformId = 'windows-amd64';

function showProModal(featureId) {
  hideActionMenus();
  lastProFeatureId = featureId;
  const name = featureName(featureId);
  const specific = I18nManager.t(`proDesc_${featureId}`, '');
  $('proModalText').textContent = specific || I18nManager.t('proModalText').replace('{name}', name);
  const list = $('proModalList');
  list.replaceChildren();
  const highlight = PRO_MODAL_HIGHLIGHT[featureId] || featureId;
  PRO_MODAL_ITEMS.forEach((item) => {
    const li = document.createElement('li');
    if (item.id === highlight) li.className = 'current';
    const title = document.createElement('strong');
    title.textContent = I18nManager.t(item.titleKey);
    const desc = document.createElement('span');
    desc.className = 'pro-item-desc';
    desc.textContent = I18nManager.t(item.descKey);
    li.append(title, desc);
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
    state.tabs.forEach((tab) => {
      if (!FREE_AUTH.has(tab.authType)) tab.authType = 'none';
      if (!FREE_BODY.has(tab.bodyType)) tab.bodyType = 'json';
      if (isSocketMethod(tab.method)) tab.method = 'GET';
    });
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
  updateFreeQuotaHint();
  renderCollections();
  if (state.tabs.length) writeTabToForm();
}

async function setPro(enabled) {
  const wasPro = state.isPro;
  state.isPro = Boolean(enabled);
  $('proToggle').checked = state.isPro;
  await chrome.storage.local.set({ isPro: state.isPro });
  applyProUi();
  persistWorkspace();
  if (wasPro && !state.isPro && collectionsManager.collections.length > FREE_COLLECTION_LIMIT) {
    const extra = collectionsManager.collections.length - FREE_COLLECTION_LIMIT;
    UIHelpers.showToast(I18nManager.t('freeCollectionOverQuota').replace('{n}', String(extra)), 'info');
  }
}

function current() {
  return state.tabs.find((t) => t.id === state.activeId) || state.tabs[0];
}

function tabFromDraft(partial = {}) {
  return {
    ...emptyRequest(partial),
    name: partial.name || I18nManager.t('defaultRequestName'),
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

function totalSavedRequests() {
  return collectionsManager.collections.reduce((n, coll) => n + flattenRequests(coll.items).length, 0);
}

async function saveCurrentRequest() {
  readFormIntoTab();
  const tab = current();
  if (!tab) return;
  if (!state.selectedCollectionId && !tab.collectionId) {
    if (!canAddCollection(state.isPro, collectionsManager.collections.length)) {
      UIHelpers.showToast(I18nManager.t('freeCollectionLimit'), 'error');
      return;
    }
    const name = prompt(I18nManager.t('newCollectionNamePlaceholder'), I18nManager.t('defaultCollectionName'));
    if (!name?.trim()) return;
    const created = await collectionsManager.create(name.trim());
    activateCollection(created.id);
  }
  const collectionId = tab.collectionId && (!state.selectedCollectionId || String(tab.collectionId) === String(state.selectedCollectionId))
    ? tab.collectionId
    : (state.selectedCollectionId || tab.collectionId);
  if (collectionId && !collectionUnlocked(collectionId)) {
    UIHelpers.showToast(I18nManager.t('freeCollectionLocked'), 'error');
    requirePro('collections');
    return;
  }
  const folderId = String(collectionId) === String(state.selectedCollectionId) ? state.selectedFolderId : null;
  if (tab.collectionItemId && tab.collectionId && String(tab.collectionId) === String(collectionId)) {
    await collectionsManager.updateRequest(collectionId, tab.collectionItemId, collectionRequestPayload(tab));
    await collectionsManager.moveItem(collectionId, tab.collectionItemId, folderId);
  } else {
    if (!canAddRequest(state.isPro, totalSavedRequests())) {
      UIHelpers.showToast(I18nManager.t('freeRequestLimit'), 'error');
      return;
    }
    const saved = await collectionsManager.addRequest(
      collectionId,
      collectionRequestPayload({ ...tab, collectionItemId: newId() }),
      folderId
    );
    tab.collectionId = collectionId;
    tab.collectionItemId = saved.id;
  }
  persistWorkspace();
  renderTabs();
  renderCollections();
  UIHelpers.showToast(I18nManager.t('requestSaved'), 'success');
}

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
      input.placeholder = I18nManager.t(field === 'key' ? 'kvKey' : 'kvValue');
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
  toggleBodyJsonTools();
  renderKvs();
  renderResponse(tab);
  renderTabs();
  syncWorkspaceMode();
  updateEnvHint();
  updateFileLabels();
}

function renderKvs() {
  const tab = current();
  bindKv($('queryList'), tab.params, ['key', 'value'], () => {
    tab.url = applyParamsToUrl(tab.url.split('?')[0], tab.params);
    $('urlInput').value = tab.url;
  });
  bindKv($('pathList'), tab.pathParams, ['key', 'value'], () => {});
  bindKv($('headersList'), tab.headers, ['key', 'value'], () => {});
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

const COLLECTION_RUN_TAB_ID = '__collection_run__';

function loadCollectionRunTab(partial) {
  const prev = current();
  if (prev && prev.id !== COLLECTION_RUN_TAB_ID) readFormIntoTab();
  if (prev && prev.id !== COLLECTION_RUN_TAB_ID) closeSocket(true);
  const tab = tabFromDraft({ ...partial, id: COLLECTION_RUN_TAB_ID });
  const i = state.tabs.findIndex((t) => t.id === COLLECTION_RUN_TAB_ID);
  if (i >= 0) state.tabs[i] = tab;
  else state.tabs.push(tab);
  state.activeId = COLLECTION_RUN_TAB_ID;
  writeTabToForm();
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

function collectionUnlocked(collectionId) {
  return isCollectionUnlocked(state.isPro, collectionsManager.collections, collectionId);
}

function updateFreeQuotaHint() {
  const el = $('freeQuotaHint');
  if (!el) return;
  if (state.isPro) {
    el.hidden = true;
    el.textContent = '';
    return;
  }
  const extra = Math.max(0, collectionsManager.collections.length - FREE_COLLECTION_LIMIT);
  if (!extra) {
    el.hidden = true;
    el.textContent = '';
    return;
  }
  el.hidden = false;
  el.textContent = I18nManager.t('freeCollectionOverQuota').replace('{n}', String(extra));
}

function toggleAuth() {
  const type = $('authType')?.value || 'none';
  $('authHint') && ($('authHint').textContent = I18nManager.t(`authHint_${type}`));
  $('authBearerFields')?.classList.toggle('hidden', type !== 'bearer');
  $('basicAuthFields')?.classList.toggle('hidden', type !== 'basic' && type !== 'digest');
  $('digestHint')?.classList.toggle('hidden', type !== 'digest');
  $('apiKeyFields')?.classList.toggle('hidden', type !== 'apikey');
  $('oauth2Fields')?.classList.toggle('hidden', type !== 'oauth2');
}

function updateFileLabels() {
  const multiLabel = $('multiFilesLabel');
  if (multiLabel) {
    const files = $('multiFiles')?.files;
    multiLabel.textContent = files?.length
      ? [...files].map((f) => f.name).join(', ')
      : I18nManager.t('noFileChosen');
  }
  const binLabel = $('binaryFileLabel');
  if (binLabel) {
    const file = $('binaryFile')?.files?.[0];
    binLabel.textContent = file ? file.name : I18nManager.t('noFileChosen');
  }
}

function isJsonBodyType(type = $('bodyType')?.value) {
  return type === 'json' || type === 'graphql';
}

function toggleBodyJsonTools() {
  const on = isJsonBodyType();
  ['formatJsonBtn', 'minifyJsonBtn'].forEach((id) => {
    const btn = $(id);
    if (!btn) return;
    btn.disabled = !on;
    btn.title = on ? '' : I18nManager.t('jsonToolsNeedJson');
  });
  if (!on) $('jsonError').textContent = '';
}

function syncWorkspaceMode() {
  const socket = isSocketMethod($('methodSelect').value);
  $('httpActions')?.classList.toggle('hidden', socket);
  $('wsActions')?.classList.toggle('hidden', !socket);
  $('httpSplit')?.classList.toggle('hidden', socket);
  $('wsWorkspace')?.classList.toggle('hidden', !socket);
  const sse = $('methodSelect').value === 'SSE';
  if (socket) {
    $('urlInput').placeholder = sse ? 'https://example.com/events' : 'wss://echo.websocket.org';
    $('wsSendBtn')?.classList.toggle('hidden', sse);
    $('wsMessageInput')?.classList.toggle('hidden', sse);
    if ($('wsHelp')) $('wsHelp').textContent = I18nManager.t(sse ? 'sseHelp' : 'wsHelp');
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
  if (!isSocketMethod(tab.method)) tab.method = 'WS';
  if (!tab.url || (tab.method === 'WS' && tab.url.startsWith('http'))) tab.url = 'wss://echo.websocket.org';
  writeTabToForm();
}

async function updateEnvHint() {
  const hint = $('urlHint');
  if (!hint) return;
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
  if (!collectionUnlocked(state.selectedCollectionId)) {
    el.textContent = I18nManager.t('freeCollectionLocked');
    return;
  }
  const coll = collectionsManager.collections.find((c) => String(c.id) === String(state.selectedCollectionId));
  let folderPart = '';
  if (state.selectedFolderId && coll) {
    const folder = findItem(coll.items, state.selectedFolderId);
    folderPart = I18nManager.t('collectionTargetFolder').replace('{folder}', folder?.name || '');
  }
  el.textContent = I18nManager.t('collectionTarget').replace('{name}', coll?.name || '').replace('{folder}', folderPart);
}

async function envVars() {
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

async function buildHttpFields() {
  const tab = current();
  readFormIntoTab();
  if (isSocketMethod(tab.method)) return { socket: true, tab };
  let url = tab.url.trim();
  if (!url) {
    UIHelpers.showToast(I18nManager.t('enterUrl'), 'error');
    return null;
  }
  if (!state.isPro && !FREE_AUTH.has(tab.authType)) {
    requirePro(authFeatureId(tab.authType));
    return null;
  }
  if (!state.isPro && !FREE_BODY.has(tab.bodyType)) {
    requirePro(bodyFeatureId(tab.bodyType));
    return null;
  }
  const ctx = { variables: await envVars(), request: tab };
  if (state.isPro && tab.preRequest) {
    try {
      runPreRequest(tab.preRequest, ctx);
    } catch (e) {
      UIHelpers.showToast(I18nManager.t('preRequestFailed').replace('{error}', e.message), 'error');
      return null;
    }
  }
  url = applyEnvVars(applyPathParams(applyParamsToUrl(url, tab.params), tab.pathParams), ctx.variables);
  tab.sentUrl = url;
  if (!isHttpUrl(url)) {
    UIHelpers.showToast(I18nManager.t('invalidUrl'), 'error');
    return null;
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
  } else if (tab.authType === 'digest') {
    headers['X-Digest-User'] = applyEnvVars(tab.auth.user || '', ctx.variables);
    headers['X-Digest-Pass'] = applyEnvVars(tab.auth.pass || '', ctx.variables);
  }

  let body = applyEnvVars(tab.body, ctx.variables);
  let multipart = null;
  let binaryBody = null;
  if (tab.bodyType === 'json' || tab.bodyType === 'graphql') {
    try {
      JSON.parse(body || 'null');
    } catch {
      UIHelpers.showToast(I18nManager.t('invalidJson'), 'error');
      return null;
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

  return { tab, ctx, url, headers, body, multipart, binaryBody };
}

async function sendCurrent() {
  const built = await buildHttpFields();
  if (!built) return;
  const { tab } = built;
  if (built.socket) {
    await connectSocket();
    return;
  }
  const { url, headers, body, multipart, binaryBody, ctx } = built;

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
  try {
    tab.testResults = state.isPro ? runTests(tab.tests, response, ctx) : [];
  } catch (error) {
    tab.testResults = [{ name: 'tests', pass: false, error: error.message }];
  }
  state.lastRequest = payload;
  renderResponse(tab);
  try {
    await historyManager.add(
      {
        name: tab.name,
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
    if (!json.access_token) throw new Error(I18nManager.t('oauthFailed'));
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
    $('responseBody').textContent = I18nManager.t('responseEmpty');
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
  const hintKey = hintForResponse(res);
  $('respHint').textContent = hintKey ? I18nManager.t(hintKey) : '';
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
    div.textContent = `${t.pass ? I18nManager.t('testPass') : I18nManager.t('testFail')} ${t.name}${t.error ? ` — ${t.error}` : ''}`;
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
    diff.textContent = I18nManager.t('snapshotNeed');
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

function hideActionMenus() {
  $('importMenu')?.classList.add('hidden');
  $('exportMenu')?.classList.add('hidden');
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
    updateFreeQuotaHint();
    return;
  }
  collectionsManager.collections.forEach((coll) => {
    const selected = String(state.selectedCollectionId) === String(coll.id);
    const expanded = String(state.expandedCollectionId) === String(coll.id);
    const locked = !collectionUnlocked(coll.id);
    const searching = Boolean(q);
    if (searching) {
      const hay = `${coll.name} ${flattenRequests(coll.items).map((r) => `${r.name} ${r.url}`).join(' ')}`.toLowerCase();
      if (!hay.includes(q)) return;
    }
    const wrap = document.createElement('div');
    wrap.className = `tree-collection-wrap${selected ? ' is-selected' : ''}${locked ? ' is-locked' : ''}`;
    const title = document.createElement('div');
    title.className = `tree-item tree-collection${selected ? ' selected' : ''}${locked ? ' locked' : ''}`;
    title.dataset.testid = 'tree-collection';
    title.dataset.collectionId = String(coll.id);
    title.setAttribute('aria-expanded', expanded || searching ? 'true' : 'false');
    title.textContent = `${expanded || searching ? '▾' : '▸'} ${coll.name}${locked ? ' 🔒' : ''}`;
    title.title = locked ? I18nManager.t('freeCollectionLocked') : I18nManager.t('collectionDblHint');
    title.onclick = () => {
      if (selected && expanded) {
        state.expandedCollectionId = null;
      } else {
        activateCollection(coll.id);
      }
      renderCollections();
    };
    title.ondblclick = (e) => showTreeMenu(e, { kind: 'collection', coll });
    makeDropTarget(title, coll.id, null);
    wrap.appendChild(title);
    const draw = (items, pad) => {
      (items || []).forEach((item) => {
        if (item.type === 'folder') {
          const f = document.createElement('div');
          f.className = `tree-item${String(state.selectedFolderId) === String(item.id) ? ' selected' : ''}`;
          f.dataset.testid = 'tree-folder';
          f.dataset.folderId = String(item.id);
          f.style.paddingLeft = `${pad}px`;
          f.textContent = `▸ ${item.name}`;
          f.title = I18nManager.t('collectionDblHint');
          f.onclick = () => {
            activateCollection(coll.id, item.id);
            renderCollections();
          };
          f.ondblclick = (e) => showTreeMenu(e, { kind: 'folder', coll, item });
          makeDropTarget(f, coll.id, item.id);
          wrap.appendChild(f);
          draw(item.items, pad + 12);
        } else if (!q || `${item.name} ${item.url}`.toLowerCase().includes(q)) {
          const r = document.createElement('div');
          const isOpen = Boolean(findOpenCollectionTab(coll.id, item.id));
          r.className = `tree-item${isOpen ? ' open-req' : ''}`;
          r.dataset.testid = 'tree-request';
          r.dataset.requestId = String(item.id);
          r.dataset.requestName = item.name || item.url || 'request';
          r.style.paddingLeft = `${pad}px`;
          r.title = I18nManager.t('collectionOpenHint');
          const m = document.createElement('span');
          m.className = `method ${item.method || 'GET'}`;
          m.textContent = item.method || 'GET';
          r.append(m, document.createTextNode(` ${item.name || item.url || 'request'}`));
          r.onclick = () => {
            if (locked) {
              requirePro('collections');
              return;
            }
            activateCollection(coll.id, findParentId(coll.items, item.id) || null);
            openTab({ ...item, collectionId: coll.id, collectionItemId: item.id });
            renderCollections();
          };
          r.draggable = true;
          r.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', JSON.stringify({ collectionId: coll.id, itemId: item.id }));
            e.dataTransfer.effectAllowed = 'move';
          });
          wrap.appendChild(r);
        }
      });
    };
    if (expanded || searching) draw(coll.items, 12);
  tree.appendChild(wrap);
  });
  updateFreeQuotaHint();
  updateCollectionTarget();
}

function makeDropTarget(el, collectionId, folderId) {
  el.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    el.classList.add('drag-over');
  });
  el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
  el.addEventListener('drop', async (e) => {
    e.preventDefault();
    el.classList.remove('drag-over');
    let payload;
    try {
      payload = JSON.parse(e.dataTransfer.getData('text/plain') || '{}');
    } catch {
      return;
    }
    if (!payload.itemId || String(payload.collectionId) !== String(collectionId)) return;
    if (!collectionUnlocked(collectionId)) {
      requirePro('collections');
      return;
    }
    const ok = await collectionsManager.moveItem(collectionId, payload.itemId, folderId);
    if (ok) {
      state.selectedCollectionId = collectionId;
      state.selectedFolderId = folderId;
      state.expandedCollectionId = collectionId;
      renderCollections();
    }
  });
}

function formatHistoryTime(ts) {
  const d = new Date(Number(ts));
  if (!ts || Number.isNaN(d.getTime())) return '';
  const locale = I18nManager.getCurrentLanguage() === 'ru' ? 'ru-RU' : 'en-GB';
  return d.toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function renderHistory() {
  const box = $('historyList');
  if (!box) return;
  box.replaceChildren();
  const query = ($('historySearch')?.value || '').trim().toLowerCase();
  const items = historyManager.getItems(state.historyLimit).filter((item) => {
    if (!query) return true;
    const hay = `${item.name || ''} ${item.method || ''} ${item.url || ''} ${item.status ?? ''}`.toLowerCase();
    return hay.includes(query);
  });
  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-hint';
    empty.textContent = I18nManager.t('historyEmpty');
    box.appendChild(empty);
    return;
  }
  items.forEach((item) => {
    const div = document.createElement('div');
    div.className = 'history-item';
    div.setAttribute('data-testid', 'history-item');
    const top = document.createElement('div');
    top.className = 'history-item-top';
    const m = document.createElement('span');
    m.className = `method ${item.method || ''}`;
    m.textContent = item.method || '';
    const name = document.createElement('span');
    name.className = 'history-name';
    name.textContent = item.name || I18nManager.t('defaultRequestName');
    const status = document.createElement('span');
    const code = Number(item.status);
    status.className = `history-status ${code >= 200 && code < 400 ? 'ok' : 'bad'}`;
    status.textContent = item.status == null ? '' : String(item.status);
    const time = document.createElement('span');
    time.className = 'history-time';
    time.textContent = formatHistoryTime(item.timestamp);
    top.append(m, name, status, time);
    const url = document.createElement('div');
    url.className = 'history-url';
    url.textContent = item.url || '';
    div.append(top, url);
    div.onclick = () => {
      openTab({
        name: item.name,
        method: item.method,
        url: item.url,
        headers: item.headers,
        body: item.body,
        bodyType: item.bodyType,
        authType: item.authType,
      });
      $('historyModal')?.classList.add('hidden');
    };
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
  const selected = isEnvSelectAction(select.value) ? '' : select.value;
  select.replaceChildren();
  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = I18nManager.t('noEnvironment');
  select.appendChild(empty);
  const list = await environmentsManager.getAll();
  list.forEach((env) => {
    const o = document.createElement('option');
    o.value = env.id;
    o.textContent = env.name;
    select.appendChild(o);
  });
  const split = document.createElement('option');
  split.disabled = true;
  split.textContent = '────────';
  select.appendChild(split);
  const add = document.createElement('option');
  add.value = ENV_SELECT_NEW;
  add.textContent = I18nManager.t('envSelectNew');
  select.appendChild(add);
  if (list.length) {
    const manage = document.createElement('option');
    manage.value = ENV_SELECT_MANAGE;
    manage.textContent = I18nManager.t('envSelectManage');
    select.appendChild(manage);
  }
  if (selected && list.some((env) => String(env.id) === String(selected))) {
    select.value = selected;
    select.dataset.activeEnv = selected;
  } else {
    select.dataset.activeEnv = '';
  }
  await updateEnvHint();
}

function openEnvEditor({ focusCreate = false } = {}) {
  renderEnvEditor();
  $('envModal').classList.remove('hidden');
  if (focusCreate) {
    requestAnimationFrame(() => $('newEnvName')?.focus());
  }
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
        $('environmentSelect').dataset.activeEnv = '';
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
      if (!canAddEnvVar(state.isPro, Object.keys(env.variables).length)) {
        UIHelpers.showToast(I18nManager.t('freeEnvVarLimit'), 'error');
        return;
      }
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
    { label: I18nManager.t('cmdFormatJson'), run: () => { if (isJsonBodyType()) formatBody(); } },
    {
      label: I18nManager.t('cmdOpenEnv'),
      run: () => openEnvEditor(),
    },
    { label: I18nManager.t('cmdOpenHistory'), run: () => { renderHistory(); $('historyModal').classList.remove('hidden'); } },
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
        if (!collectionUnlocked(hit.collection.id)) {
          requirePro('collections');
          return;
        }
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

function applyBodyJson(transform) {
  if (!isJsonBodyType()) return;
  const raw = $('bodyEditor').value;
  if (!String(raw).trim()) {
    $('jsonError').textContent = '';
    return;
  }
  try {
    const next = transform(raw);
    $('bodyEditor').value = next;
    $('jsonError').textContent = '';
    const tab = current();
    if (tab) tab.body = next;
  } catch (e) {
    const message = e.message || String(e);
    $('jsonError').textContent = message;
    UIHelpers.showToast(I18nManager.t('jsonErrorToast').replace('{error}', message), 'error');
  }
}

function formatBody() {
  applyBodyJson(formatJson);
}

function minifyBody() {
  applyBodyJson(minifyJson);
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
    UIHelpers.showToast(I18nManager.t('collectionSelectFirst'), 'error');
    return;
  }
  if (!collectionUnlocked(id)) {
    requirePro('collections');
    return;
  }
  const reqs = collectionsManager.flatten(id);
  $('runModal').classList.remove('hidden');
  const report = $('runReport');
  report.replaceChildren();
  for (const req of reqs) {
    loadCollectionRunTab({ ...req, collectionId: id, collectionItemId: req.id });
    await sendCurrent();
    const tab = current();
    const line = document.createElement('div');
    const tests = tab.testResults || [];
    const status = tab.response?.status;
    const aborted = /abort/i.test(String(status ?? ''));
    const failed = !tab.response || aborted || tests.some((t) => !t.pass);
    line.className = failed ? 'fail' : 'pass';
    const shownUrl = tab.sentUrl || tab.url;
    const passedTests = tests.filter((t) => t.pass).length;
    line.textContent = `${tab.method} ${shownUrl} → ${status ?? '—'} tests ${passedTests}/${tests.length}`;
    report.appendChild(line);
    if (failed && $('stopOnFail').checked) break;
  }
}

function fileToBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const data = reader.result.split(',')[1];
      resolve({
        fileName: file.name,
        fileType: file.type,
        fileBase64: data,
        base64: data,
        name: file.name,
      });
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
  if (activeEnv) {
    $('environmentSelect').value = String(activeEnv);
    $('environmentSelect').dataset.activeEnv = String(activeEnv);
  }
  writeTabToForm();
  syncWorkspaceMode();
  await updateEnvHint();
  const savedAgent = await chrome.storage.local.get(['loadtest_agent', 'loadtest_manifest_url']);
  if ($('loadAgentUrl') && savedAgent.loadtest_agent) $('loadAgentUrl').value = savedAgent.loadtest_agent;
  if ($('loadManifestUrl') && savedAgent.loadtest_manifest_url) $('loadManifestUrl').value = savedAgent.loadtest_manifest_url;
  await refreshLoadAgentDownload();
}

function loadAgentBase() {
  return $('loadAgentUrl')?.value || DEFAULT_LOADTEST_AGENT;
}

function platformLabel(id) {
  return I18nManager.t(`loadPlatform_${String(id).replace(/-/g, '_')}`);
}

function renderLoadDownload() {
  if (!loadManifest) return;
  const asset = loadManifest.assets[loadPlatformId] || loadManifest.assets['windows-amd64'];
  const btn = $('loadDownloadBtn');
  if (btn) {
    btn.textContent = I18nManager.t('loadDlButton').replace('{os}', platformLabel(loadPlatformId));
    if (asset?.url) {
      btn.href = asset.url;
      btn.classList.remove('is-disabled');
    } else {
      btn.href = loadManifest.releasePage || '#';
      btn.classList.add('is-disabled');
    }
  }
  if ($('loadDlFile')) $('loadDlFile').textContent = asset?.file || '—';
  if ($('loadDlSha')) $('loadDlSha').textContent = asset?.sha256 || I18nManager.t('loadDlShaPending');
  if ($('loadDlVerify') && asset?.file) {
    $('loadDlVerify').textContent = I18nManager.t('loadDlVerify').replace('{cmd}', verifyCommand(loadPlatformId, asset.file));
  }
  const status = $('loadDlStatus');
  if (status) {
    if (loadManifest.signed) status.textContent = I18nManager.t('loadDlSigned');
    else if (!asset?.url) status.textContent = I18nManager.t('loadDlNoRelease');
    else status.textContent = I18nManager.t('loadDlUnsigned');
  }
  const list = $('loadDlOtherList');
  if (list) {
    list.replaceChildren();
    for (const id of LOAD_AGENT_PLATFORMS) {
      if (id === loadPlatformId) continue;
      const item = loadManifest.assets[id];
      const li = document.createElement('li');
      const label = `${platformLabel(id)} — ${item.file}`;
      if (item.url) {
        const a = document.createElement('a');
        a.href = item.url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = label;
        li.appendChild(a);
      } else {
        li.textContent = label;
      }
      list.appendChild(li);
    }
  }
}

async function refreshLoadAgentDownload() {
  loadPlatformId = await detectLoadAgentPlatformAsync();
  let bundled = {};
  try {
    bundled = await (await fetch(chrome.runtime.getURL('data/loadtest-latest.json'))).json();
  } catch {
    bundled = {};
  }
  loadManifest = normalizeLoadManifest(bundled);
  const remoteUrl = String($('loadManifestUrl')?.value || loadManifest.remoteManifest || DEFAULT_LOADTEST_MANIFEST_URL).trim();
  if (remoteUrl) {
    try {
      const remote = await fetchLoadManifest(remoteUrl);
      loadManifest = mergeLoadManifest(loadManifest, remote);
      await chrome.storage.local.set({ loadtest_manifest_url: remoteUrl });
    } catch {
      /* keep bundled */
    }
  }
  renderLoadDownload();
}

async function pingLoadAgent() {
  const status = $('loadAgentStatus');
  try {
    const info = await checkLoadAgent(loadAgentBase());
    let line = I18nManager.t('loadtestAgentOk')
      .replace('{service}', info.service || 'pingto-loadtest')
      .replace('{version}', info.version || '—');
    const latest = loadManifest?.version;
    if (latest && info.version && compareVersions(info.version, latest) < 0) {
      line += ` · ${I18nManager.t('loadDlUpdate').replace('{current}', info.version).replace('{latest}', latest)}`;
    }
    if (status) status.textContent = line;
    await chrome.storage.local.set({ loadtest_agent: loadAgentBase() });
  } catch (e) {
    if (status) status.textContent = I18nManager.t('loadtestAgentFail').replace('{error}', e.message);
  }
}

function syncLoadProfileFields() {
  const hold = $('loadProfile')?.value === 'hold';
  $('loadHoldWrap')?.classList.toggle('hidden', !hold);
}

function sparkPolylines(svg, series, maxVal) {
  if (!svg) return;
  const ns = 'http://www.w3.org/2000/svg';
  svg.replaceChildren();
  for (const line of series) {
    const el = document.createElementNS(ns, 'polyline');
    el.setAttribute('class', line.className);
    el.setAttribute('points', sparklinePoints(line.values, 240, 64, maxVal));
    svg.appendChild(el);
  }
}

function renderLoadVisual(snap) {
  const root = $('loadVisual');
  if (!root || !snap) return;
  root.classList.remove('hidden');
  root.classList.toggle('is-aborted', snap.status === 'aborted');
  root.classList.toggle('is-done', snap.status === 'done');
  const t = (key) => I18nManager.t(key);
  const lat = snap.latency || {};
  const statusEl = $('loadKpiStatus');
  statusEl?.classList.toggle('is-ok', snap.status === 'done');
  statusEl?.classList.toggle('is-bad', snap.status === 'aborted' || snap.status === 'error');
  statusEl?.classList.toggle('is-run', snap.status === 'running');
  if ($('loadKpiStatusVal')) {
    $('loadKpiStatusVal').textContent = snap.abort
      ? `${t(`loadStatus_${snap.status}`)} · ${t(`loadAbort_${snap.abort}`)}`
      : t(`loadStatus_${snap.status || 'running'}`);
  }
  const target = Number(snap.spec?.rps) || 0;
  const live = Number.isFinite(Number(snap.rpsLive)) ? Number(snap.rpsLive) : Number(snap.rps) || 0;
  if ($('loadKpiRpsAvg')) $('loadKpiRpsAvg').textContent = Number(snap.rps || 0).toFixed(1);
  if ($('loadKpiRpsMax')) $('loadKpiRpsMax').textContent = (Number(snap.rpsMax) || 0).toFixed(0);
  if ($('loadKpiRps')) {
    $('loadKpiRps').textContent = target > 0 ? `${live.toFixed(0)} / ${target}` : live.toFixed(0);
  }
  if ($('loadKpiErr')) $('loadKpiErr').textContent = `${((Number(snap.errorRate) || 0) * 100).toFixed(1)}%`;
  if ($('loadKpiP95')) $('loadKpiP95').textContent = `${formatMs(lat.p95Ms)} ms`;
  if ($('loadKpiTotal')) $('loadKpiTotal').textContent = String(snap.total || 0);
  if ($('loadKpiClients')) $('loadKpiClients').textContent = `${snap.desiredWorkers || 0} / ${snap.spec?.workers || 0}`;
  const pct = loadProgressPct(snap);
  if ($('loadProgressFill')) $('loadProgressFill').style.width = `${pct}%`;
  if ($('loadProgressLabel')) {
    $('loadProgressLabel').textContent = `${t(`loadPhase_${snap.phase || 'steady'}`)} · ${snap.elapsedMs || 0} ms`;
  }
  const rps = loadHistory.map((s) => s.rps);
  const p50 = loadHistory.map((s) => s.p50);
  const p95 = loadHistory.map((s) => s.p95);
  const p99 = loadHistory.map((s) => s.p99);
  const err = loadHistory.map((s) => s.err);
  const cli = loadHistory.map((s) => s.clients);
  sparkPolylines($('loadChartRps'), [{ className: 's-rps', values: rps }]);
  sparkPolylines($('loadChartLat'), [
    { className: 's-p50', values: p50 },
    { className: 's-p95', values: p95 },
    { className: 's-p99', values: p99 },
  ], Math.max(0, ...p50, ...p95, ...p99));
  sparkPolylines($('loadChartErr'), [{ className: 's-err', values: err }], 100);
  sparkPolylines($('loadChartCli'), [{ className: 's-cli', values: cli }], snap.spec?.workers || Math.max(1, ...cli));
  if ($('loadChartRpsVal')) $('loadChartRpsVal').textContent = live.toFixed(0);
  if ($('loadChartLatVal')) $('loadChartLatVal').textContent = `p95 ${formatMs(lat.p95Ms)} ms`;
  if ($('loadChartErrVal')) $('loadChartErrVal').textContent = `${((Number(snap.errorRate) || 0) * 100).toFixed(1)}%`;
  if ($('loadChartCliVal')) $('loadChartCliVal').textContent = String(snap.desiredWorkers || 0);
  const mix = mixShares(snap.ok, snap.fail, snap.timeout);
  const mixRoot = $('loadMix');
  if (mixRoot) {
    const [okBar, failBar, toBar] = mixRoot.querySelectorAll('i');
    if (okBar) okBar.style.flex = String(mix.ok || 0.0001);
    if (failBar) failBar.style.flex = String(mix.fail || 0.0001);
    if (toBar) toBar.style.flex = String(mix.timeout || 0.0001);
  }
  if ($('loadMixLegend')) {
    $('loadMixLegend').textContent = `${t('loadReportOk')} ${snap.ok || 0} · ${t('loadReportFail')} ${snap.fail || 0} · ${t('loadReportTimeout')} ${snap.timeout || 0}`;
  }
  const codesEl = $('loadCodes');
  if (codesEl) {
    const codes = snap.statusCodes || {};
    const keys = Object.keys(codes).sort((a, b) => Number(a) - Number(b));
    const max = Math.max(1, ...keys.map((k) => Number(codes[k]) || 0));
    codesEl.replaceChildren();
    for (const code of keys) {
      const row = document.createElement('div');
      row.className = 'load-code-row';
      const label = document.createElement('b');
      label.textContent = code;
      const bar = document.createElement('div');
      bar.className = `load-code-bar is-${httpTone(code)}`;
      const fill = document.createElement('i');
      fill.style.width = `${(100 * (Number(codes[code]) || 0)) / max}%`;
      bar.appendChild(fill);
      const n = document.createElement('em');
      n.textContent = String(codes[code]);
      row.append(label, bar, n);
      codesEl.appendChild(row);
    }
  }
}

function renderLoadSnapshot(snap, sample = true) {
  lastLoadReport = snap;
  if (sample) loadHistory = pushLoadSample(loadHistory, snap);
  const el = $('loadReport');
  if (el) el.textContent = formatLoadReport(snap, (key) => I18nManager.t(key));
  renderLoadVisual(snap);
}

async function startLoadTest() {
  if (!requirePro('loadtest')) return;
  const built = await buildHttpFields();
  if (!built) return;
  if (built.socket) {
    UIHelpers.showToast(I18nManager.t('loadtestNeedHttp'), 'error');
    return;
  }
  if (built.multipart || built.binaryBody) {
    UIHelpers.showToast(I18nManager.t('loadtestBodySimple'), 'error');
    return;
  }
  if (loadUnsub) {
    loadUnsub();
    loadUnsub = null;
  }
  loadHistory = [];
  let ammo = [];
  try {
    ammo = parseAmmoJson($('loadAmmo')?.value);
  } catch (e) {
    UIHelpers.showToast(I18nManager.t('loadtestAmmoBad').replace('{error}', e.message), 'error');
    return;
  }
  try {
    const snap = await startLoadRun(loadAgentBase(), clampLoadSpec({
      method: built.tab.method,
      url: built.url,
      headers: built.headers,
      body: built.body || '',
      workers: $('loadWorkers')?.value,
      profile: $('loadProfile')?.value,
      rampMs: $('loadRampMs')?.value,
      holdMs: $('loadHoldMs')?.value,
      count: $('loadCount')?.value,
      rps: $('loadRps')?.value,
      timeoutMs: $('loadTimeout')?.value,
      abortErrorPct: $('loadAbortError')?.value,
      abortP95Ms: $('loadAbortP95')?.value,
      abortConsecutive: $('loadAbortStreak')?.value,
      abortAfter: $('loadAbortAfter')?.value,
      abortGraceMs: $('loadAbortGrace')?.value,
      ammo,
      ammoMode: $('loadAmmoMode')?.value,
      compensate: parseCompensate($('loadCompMethod')?.value, $('loadCompUrl')?.value),
      followRedirects: built.tab.followRedirects,
    }));
    loadRunId = snap.id;
    renderLoadSnapshot(snap);
    loadUnsub = subscribeLoadRun(loadAgentBase(), snap.id, (s) => {
      renderLoadSnapshot(s);
      if (s.status && s.status !== 'running') {
        loadUnsub?.();
        loadUnsub = null;
        if (s.status === 'aborted') {
          UIHelpers.showToast(I18nManager.t('loadtestAborted').replace('{reason}', I18nManager.t(`loadAbort_${s.abort || 'error_rate'}`)), 'error');
        }
      }
    }, () => {});
  } catch (e) {
    UIHelpers.showToast(I18nManager.t('loadtestStartFail').replace('{error}', e.message), 'error');
  }
}

async function stopLoadTest() {
  if (loadRunId) {
    try {
      renderLoadSnapshot(await stopLoadRun(loadAgentBase(), loadRunId));
    } catch (e) {
      UIHelpers.showToast(e.message, 'error');
    }
  }
  loadUnsub?.();
  loadUnsub = null;
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
  if (current()) current().bodyType = $('bodyType').value;
  toggleBodyJsonTools();
};
$('environmentSelect').onchange = async () => {
  const select = $('environmentSelect');
  const value = select.value;
  if (value === ENV_SELECT_NEW) {
    select.value = select.dataset.activeEnv || '';
    openEnvEditor({ focusCreate: true });
    return;
  }
  if (value === ENV_SELECT_MANAGE) {
    select.value = select.dataset.activeEnv || '';
    openEnvEditor();
    return;
  }
  select.dataset.activeEnv = value;
  await storage.set('active_env_id', value || null);
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
  renderTabs();
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
}, 200);
$('bodyEditor').oninput = () => {
  if ($('bodyType').value === 'json') $('jsonError').textContent = jsonError($('bodyEditor').value) || '';
  const tab = current();
  if (tab) tab.body = $('bodyEditor').value;
};
$('formatJsonBtn').onclick = formatBody;
$('minifyJsonBtn').onclick = minifyBody;
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
  UIHelpers.showToast(I18nManager.t('binaryLoaded').replace('{name}', file.name), 'success');
  updateFileLabels();
};
$('pickMultiFilesBtn').onclick = () => $('multiFiles').click();
$('multiFiles').onchange = async (e) => {
  current().files = [];
  for (const file of [...e.target.files]) {
    const encoded = await fileToBase64(file);
    encoded.name = file.name;
    current().files.push(encoded);
  }
  updateFileLabels();
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
  UIHelpers.showToast(I18nManager.t('snapshotSaved'), 'success');
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
$('generateCodeBtn').onclick = generateCode;
$('copyCodeBtn').onclick = () => {
  generateCode();
  navigator.clipboard.writeText($('codeOutput').textContent);
};
$('loadPingBtn').onclick = pingLoadAgent;
$('loadStartBtn').onclick = startLoadTest;
$('loadStopBtn').onclick = stopLoadTest;
if ($('loadProfile')) $('loadProfile').onchange = syncLoadProfileFields;
syncLoadProfileFields();
$('loadManifestRefresh')?.addEventListener('click', refreshLoadAgentDownload);
$('loadCopyShaBtn')?.addEventListener('click', () => {
  const sha = loadManifest?.assets?.[loadPlatformId]?.sha256;
  if (!sha) {
    UIHelpers.showToast(I18nManager.t('loadDlShaPending'), 'info');
    return;
  }
  navigator.clipboard.writeText(sha);
  UIHelpers.showToast(I18nManager.t('loadDlShaCopied'), 'success');
});
$('loadCopyBtn').onclick = () => {
  if (!lastLoadReport) return;
  navigator.clipboard.writeText(formatLoadReport(lastLoadReport, (key) => I18nManager.t(key)));
  UIHelpers.showToast(I18nManager.t('loadtestCopied'), 'success');
};
$('loadDownloadBtnReport')?.addEventListener('click', () => {
  if (!lastLoadReport) return;
  const html = buildLoadReportHtml(lastLoadReport, loadHistory, (key) => I18nManager.t(key));
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `pingto-load-${Date.now()}.html`;
  a.click();
  URL.revokeObjectURL(a.href);
  UIHelpers.showToast(I18nManager.t('loadtestDownloaded'), 'success');
});
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
  if (!canAddCollection(state.isPro, collectionsManager.collections.length)) {
    UIHelpers.showToast(I18nManager.t('freeCollectionLimit'), 'error');
    return;
  }
  const name = prompt(I18nManager.t('newCollectionNamePlaceholder'), I18nManager.t('defaultCollectionName'));
  if (!name?.trim()) return;
  const created = await collectionsManager.create(name.trim());
  activateCollection(created.id);
  renderCollections();
  UIHelpers.showToast(I18nManager.t('collectionCreated'), 'success');
};
$('newFolderBtn').onclick = async () => {
  if (!state.selectedCollectionId) return UIHelpers.showToast(I18nManager.t('collectionSelectFirst'), 'error');
  if (!collectionUnlocked(state.selectedCollectionId)) {
    requirePro('collections');
    return;
  }
  const name = prompt(I18nManager.t('newFolderBtn'), I18nManager.t('defaultFolderName'));
  if (name) {
    await collectionsManager.addFolder(state.selectedCollectionId, name, state.selectedFolderId);
    renderCollections();
  }
};
let pendingImportFormat = 'pingto';

function toggleActionMenu(menuId, event) {
  event.stopPropagation();
  const menu = $(menuId);
  const open = menu.classList.contains('hidden');
  hideActionMenus();
  hideTreeMenu();
  if (open) menu.classList.remove('hidden');
}

async function collectionsForExport() {
  if (state.selectedCollectionId) {
    const one = await collectionsManager.exportCollection(state.selectedCollectionId);
    return one ? [one] : [];
  }
  return collectionsManager.exportAll();
}

$('importAnyBtn').onclick = (e) => toggleActionMenu('importMenu', e);
$('exportCollectionBtn').onclick = (e) => toggleActionMenu('exportMenu', e);
$('importMenu').onclick = (e) => {
  e.stopPropagation();
  const btn = e.target.closest('[data-import]');
  if (!btn) return;
  if (btn.dataset.pro && !state.isPro) return;
  pendingImportFormat = btn.dataset.import;
  hideActionMenus();
  $('importFile').accept = pendingImportFormat === 'bruno' ? '.bru,.txt,text/plain' : '.json,application/json';
  $('importFile').click();
};
$('exportMenu').onclick = async (e) => {
  e.stopPropagation();
  const btn = e.target.closest('[data-export]');
  if (!btn) return;
  if (btn.dataset.pro && !state.isPro) return;
  hideActionMenus();
  const format = btn.dataset.export;
  const list = await collectionsForExport();
  if (!list.length) {
    UIHelpers.showToast(I18nManager.t('collectionSelectFirst'), 'error');
    return;
  }
  const base = list.length === 1 ? (list[0].name || 'collection') : 'pingto-collections';
  if (format === 'pingto') {
    UIHelpers.downloadText(`${base}.json`, JSON.stringify(toPingto(list), null, 2), 'application/json');
    return;
  }
  if (format === 'postman') {
    UIHelpers.downloadText(`${base}.postman.json`, JSON.stringify(toPostman(list), null, 2), 'application/json');
    return;
  }
  if (format === 'insomnia') {
    UIHelpers.downloadText(`${base}.insomnia.json`, JSON.stringify(toInsomnia(list), null, 2), 'application/json');
    return;
  }
  if (format === 'bruno') {
    UIHelpers.downloadText(`${base}.bru.txt`, toBrunoText(list), 'text/plain');
  }
};
$('importFile').onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const imported = importAs(pendingImportFormat, text);
    const before = collectionsManager.collections.length;
    await collectionsManager.importMany(imported);
    const added = collectionsManager.collections[before];
    if (added) activateCollection(added.id);
    renderCollections();
    UIHelpers.showToast(I18nManager.t('importedOk'), 'success');
  } catch (err) {
    const key = {
      'Unknown collection format': 'importUnknownFormat',
      'Not a Bruno collection': 'importNotBruno',
      'Not a PingTo JSON collection': 'importNotPingto',
      'Not a Postman collection': 'importNotPostman',
      'Not an Insomnia export': 'importNotInsomnia',
      'Not an OpenAPI file': 'importNotOpenapi',
      'Nothing to import': 'importNothing',
    }[err.message];
    UIHelpers.showToast(key ? I18nManager.t(key) : (err.message || I18nManager.t('importFailed')), 'error');
  }
  pendingImportFormat = 'pingto';
  e.target.value = '';
};
$('saveRequestBtn').onclick = saveCurrentRequest;
$('saveToCollectionBtn').onclick = saveCurrentRequest;
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
$('createEnvBtn').onclick = async () => {
  if (!canAddEnvironment(state.isPro, environmentsManager.environments.length)) {
    UIHelpers.showToast(I18nManager.t('freeEnvLimit'), 'error');
    return;
  }
  const name = $('newEnvName').value.trim();
  if (!name) {
    UIHelpers.showToast(I18nManager.t('envNeedName'), 'error');
    return;
  }
  const env = await environmentsManager.create(name, { base_url: 'https://api.example.com' });
  $('newEnvName').value = '';
  await renderEnvs();
  $('environmentSelect').value = String(env.id);
  $('environmentSelect').dataset.activeEnv = String(env.id);
  await storage.set('active_env_id', env.id);
  renderEnvEditor();
  await updateEnvHint();
  UIHelpers.showToast(I18nManager.t('envCreated'), 'success');
};
$('closeEnvBtn').onclick = () => $('envModal').classList.add('hidden');
$('settingsBtn').onclick = () => $('settingsModal').classList.remove('hidden');
$('historyBtn').onclick = () => {
  renderHistory();
  $('historyModal').classList.remove('hidden');
};
$('closeHistoryBtn').onclick = () => $('historyModal').classList.add('hidden');
$('historySearch').oninput = debounce(renderHistory, 150);
$('clearHistoryBtn').onclick = async () => {
  await historyManager.clear();
  renderHistory();
  fillUrlHistory();
};
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
$('themeToggle').onclick = () => themeManager.toggle();
$('languageToggle').onclick = async () => {
  await I18nManager.toggle();
  await renderEnvs();
};
document.addEventListener('languageChanged', async () => {
  I18nManager.apply();
  applyProUi();
  await renderEnvs();
  renderHistory();
  renderCollections();
  toggleAuth();
  syncWorkspaceMode();
  updateFileLabels();
  themeManager.apply();
  if (lastProFeatureId && !$('proModal').classList.contains('hidden')) showProModal(lastProFeatureId);
  if (lastLoadReport) renderLoadSnapshot(lastLoadReport, false);
  renderLoadDownload();
});
$('openTabBtn').onclick = () => chrome.runtime.sendMessage({ type: 'openFullscreen' });
$('sidebarToggle').onclick = () => document.body.classList.toggle('sidebar-collapsed');
$('wsBtn').onclick = () => openSocketWorkspace();
$('loadtestBtn').onclick = () => {
  if (!requirePro('loadtest')) return;
  showPane('loadtest');
};
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
  UIHelpers.showToast(I18nManager.t('tokenReady'), 'success');
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
    hideActionMenus();
  }
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('.menu-wrap')) hideActionMenus();
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
      state.expandedCollectionId = null;
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
