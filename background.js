const DEFAULT_TIMEOUT_MS = 30000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const inflight = new Map();

const APP_PATH = 'app.html';
const APP_WINDOW_WIDTH = 1280;
const APP_WINDOW_HEIGHT = 800;
let appWindowId = null;
let openAppLock = null;
const windowRestore = new Map();

function appUrl() {
  return chrome.runtime.getURL(APP_PATH);
}

function isAppTabUrl(url) {
  if (!url) return false;
  const base = appUrl();
  return url === base || url.startsWith(`${base}?`) || url.startsWith(`${base}#`);
}

async function rememberAppWindow(id) {
  appWindowId = id ?? null;
  try {
    if (appWindowId == null) await chrome.storage.session?.remove('appWindowId');
    else await chrome.storage.session?.set({ appWindowId });
  } catch {
    /* session storage optional */
  }
}

async function closeSidePanel(windowId) {
  if (!chrome.sidePanel) return;
  try {
    if (typeof chrome.sidePanel.close === 'function') {
      await chrome.sidePanel.close(windowId ? { windowId } : {});
      return;
    }
  } catch {
    /* older Chrome */
  }
  try {
    await chrome.sidePanel.setOptions({ enabled: false, path: APP_PATH });
    await chrome.sidePanel.setOptions({ enabled: true, path: `${APP_PATH}?mode=panel` });
  } catch {
    /* ignore */
  }
}

async function closeAllSidePanels() {
  if (!chrome.sidePanel) return;
  const windows = await chrome.windows.getAll();
  await Promise.all(windows.map((win) => closeSidePanel(win.id)));
}

async function listAppTabs() {
  const tabs = await chrome.tabs.query({});
  return tabs.filter((tab) => isAppTabUrl(tab.url) || isAppTabUrl(tab.pendingUrl));
}

async function closeExtraAppTabs(keepTab) {
  const tabs = await listAppTabs();
  for (const tab of tabs) {
    if (tab.id === keepTab.id) continue;
    try {
      const win = await chrome.windows.get(tab.windowId, { populate: true });
      const onlyApp = (win.tabs || []).every((t) => isAppTabUrl(t.url) || isAppTabUrl(t.pendingUrl));
      if (onlyApp) await chrome.windows.remove(tab.windowId);
      else await chrome.tabs.remove(tab.id);
    } catch {
      /* already gone */
    }
  }
}

async function adoptExistingAppWindow() {
  if (appWindowId == null) {
    try {
      const stored = await chrome.storage.session?.get('appWindowId');
      if (stored?.appWindowId) appWindowId = stored.appWindowId;
    } catch {
      /* ignore */
    }
  }
  if (appWindowId != null) {
    try {
      await chrome.windows.get(appWindowId);
      await chrome.windows.update(appWindowId, { focused: true });
      const tabs = await listAppTabs();
      const keep = tabs.find((tab) => tab.windowId === appWindowId) || tabs[0];
      if (keep) await closeExtraAppTabs(keep);
      return appWindowId;
    } catch {
      await rememberAppWindow(null);
    }
  }

  const tabs = await listAppTabs();
  if (!tabs.length) return null;
  const windows = await Promise.all(tabs.map(async (tab) => {
    try {
      return { tab, win: await chrome.windows.get(tab.windowId) };
    } catch {
      return null;
    }
  }));
  const ranked = windows.filter(Boolean).sort((a, b) => {
    const score = (row) => (row.win.type === 'popup' ? 2 : 0) + (row.win.focused ? 1 : 0);
    return score(b) - score(a);
  });
  const keep = ranked[0]?.tab;
  if (!keep) return null;
  await chrome.windows.update(keep.windowId, { focused: true });
  try {
    await chrome.tabs.update(keep.id, { active: true });
  } catch {
    /* ignore */
  }
  await closeExtraAppTabs(keep);
  await rememberAppWindow(keep.windowId);
  return keep.windowId;
}

async function openAppWindow() {
  if (openAppLock) return openAppLock;
  openAppLock = (async () => {
    await closeAllSidePanels();
    const existing = await adoptExistingAppWindow();
    if (existing != null) return existing;
    const created = await chrome.windows.create({
      url: appUrl(),
      type: 'popup',
      width: APP_WINDOW_WIDTH,
      height: APP_WINDOW_HEIGHT,
      focused: true,
    });
    await rememberAppWindow(created.id ?? null);
    const keepTab = created.tabs?.[0];
    if (keepTab?.id) await closeExtraAppTabs(keepTab);
    return created.id ?? null;
  })().finally(() => {
    openAppLock = null;
  });
  return openAppLock;
}

async function toggleFullscreen(senderWindowId) {
  await closeAllSidePanels();

  let win = null;
  if (senderWindowId) {
    try {
      win = await chrome.windows.get(senderWindowId);
    } catch {
      win = null;
    }
  }
  if (!win || win.type !== 'popup') {
    await openAppWindow();
    if (appWindowId == null) return;
    try {
      win = await chrome.windows.get(appWindowId);
    } catch {
      return;
    }
  }

  const expanded = win.state === 'fullscreen' || win.state === 'maximized';
  if (expanded) {
    const saved = windowRestore.get(win.id) || {
      width: APP_WINDOW_WIDTH,
      height: APP_WINDOW_HEIGHT,
      state: 'normal',
    };
    windowRestore.delete(win.id);
    await chrome.windows.update(win.id, { state: 'normal', focused: true });
    const restore = { focused: true };
    if (Number.isFinite(saved.width)) restore.width = saved.width;
    if (Number.isFinite(saved.height)) restore.height = saved.height;
    if (Number.isFinite(saved.left)) restore.left = saved.left;
    if (Number.isFinite(saved.top)) restore.top = saved.top;
    await chrome.windows.update(win.id, restore);
    return;
  }

  windowRestore.set(win.id, {
    state: win.state,
    width: win.width,
    height: win.height,
    left: win.left,
    top: win.top,
  });
  try {
    await chrome.windows.update(win.id, { state: 'fullscreen', focused: true });
  } catch {
    await chrome.windows.update(win.id, { state: 'maximized', focused: true });
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: false });
});
chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: false });
chrome.sidePanel?.setOptions?.({ path: `${APP_PATH}?mode=panel` });

chrome.action.onClicked.addListener(() => {
  openAppWindow();
});

chrome.windows.onRemoved.addListener((id) => {
  if (id === appWindowId) rememberAppWindow(null);
  windowRestore.delete(id);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'sendRequest') {
    handleRequest(message.data)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          error: error.message || 'Unknown error',
          status: 0,
          statusText: 'Error',
          body: `Error: ${error.message}`,
          time: 0,
          size: 0,
          ok: false,
        });
      });
    return true;
  }
  if (message.type === 'cancelRequest') {
    const controller = inflight.get(message.requestId);
    if (controller) controller.abort();
    sendResponse({ ok: true });
    return false;
  }
  if (message.type === 'getCookies') {
    chrome.cookies.getAll({ url: message.url }, (cookies) => {
      sendResponse({ cookies: cookies || [], error: chrome.runtime.lastError?.message });
    });
    return true;
  }
  if (message.type === 'setCookie') {
    chrome.cookies.set(message.details, (cookie) => {
      sendResponse({ cookie, error: chrome.runtime.lastError?.message });
    });
    return true;
  }
  if (message.type === 'removeCookie') {
    chrome.cookies.remove({ url: message.url, name: message.name }, () => {
      sendResponse({ ok: !chrome.runtime.lastError, error: chrome.runtime.lastError?.message });
    });
    return true;
  }
  if (message.type === 'launchOAuth') {
    chrome.identity.launchWebAuthFlow(
      { url: message.url, interactive: true },
      (redirectUrl) => {
        sendResponse({ redirectUrl, error: chrome.runtime.lastError?.message });
      }
    );
    return true;
  }
  if (message.type === 'openWorkspace') {
    openAppWindow().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message.type === 'openFullscreen' || message.type === 'toggleFullscreen') {
    toggleFullscreen(sender.tab?.windowId).then(() => sendResponse({ ok: true }));
    return true;
  }
});

async function handleRequest(data = {}) {
  const {
    method = 'GET',
    url,
    headers = {},
    body = null,
    timeout = DEFAULT_TIMEOUT_MS,
    multipart = null,
    digest = null,
    requestId = null,
    followRedirects = true,
    binaryBody = null,
  } = data;

  if (!url) {
    return errorResult('URL is required');
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return errorResult('Only http and https URLs are allowed');
    }
  } catch {
    return errorResult('Invalid URL');
  }

  const controller = new AbortController();
  if (requestId) inflight.set(requestId, controller);
  const timeoutMs = Number(timeout) > 0 ? Number(timeout) : DEFAULT_TIMEOUT_MS;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const requestHeaders = { ...(headers || {}) };
    if (digest?.username) {
      requestHeaders['X-Digest-User'] = digest.username;
      requestHeaders['X-Digest-Pass'] = digest.password || '';
      return await fetchWithDigest({
        method,
        url,
        headers: requestHeaders,
        body,
        multipart,
        digest,
        signal: controller.signal,
        followRedirects,
        binaryBody,
      });
    }
    return await performFetch({
      method,
      url,
      headers: requestHeaders,
      body,
      multipart,
      signal: controller.signal,
      followRedirects,
      binaryBody,
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      return errorResult('Request cancelled or timed out', 'Aborted');
    }
    return errorResult(error.message);
  } finally {
    clearTimeout(timeoutId);
    if (requestId) inflight.delete(requestId);
  }
}

function buildBody({ method, headers, body, multipart, binaryBody }) {
  const fetchHeaders = { ...headers };
  if (method === 'GET' || method === 'HEAD') return { headers: fetchHeaders, body: undefined };

  if (multipart && Array.isArray(multipart)) {
    const form = new FormData();
    multipart.forEach((field) => {
      if (!field?.name) return;
      if (field.fileBase64) {
        const bytes = Uint8Array.from(atob(field.fileBase64), (c) => c.charCodeAt(0));
        form.append(
          field.name,
          new Blob([bytes], { type: field.fileType || 'application/octet-stream' }),
          field.fileName || 'file'
        );
      } else {
        form.append(field.name, field.value ?? '');
      }
    });
    delete fetchHeaders['Content-Type'];
    delete fetchHeaders['content-type'];
    return { headers: fetchHeaders, body: form };
  }

  if (binaryBody?.base64 || binaryBody?.fileBase64) {
    const raw = binaryBody.base64 || binaryBody.fileBase64;
    const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
    return { headers: fetchHeaders, body: bytes };
  }

  return { headers: fetchHeaders, body: body || undefined };
}

async function performFetch({
  method,
  url,
  headers,
  body,
  multipart,
  signal,
  extraHeaders = {},
  followRedirects = true,
  binaryBody = null,
}) {
  const startTime = performance.now();
  const ttfbStart = performance.now();
  const redirects = [];
  let currentUrl = url;
  let currentMethod = method;
  let currentBody = { body, multipart, binaryBody };

  for (let hop = 0; hop < 10; hop++) {
    const built = buildBody({
      method: currentMethod,
      headers: { ...(headers || {}), ...extraHeaders },
      ...currentBody,
    });
    const response = await fetch(currentUrl, {
      method: currentMethod,
      headers: built.headers,
      body: built.body,
      signal,
      redirect: 'manual',
    });
    const location = response.headers.get('location');
    const opaque = response.type === 'opaqueredirect' || response.status === 0;
    redirects.push({ url: currentUrl, status: response.status, location: location || response.url || null });

    if (followRedirects && opaque) {
      const followed = await fetch(currentUrl, {
        method: currentMethod,
        headers: built.headers,
        body: built.body,
        signal,
        redirect: 'follow',
      });
      const ttfb = Math.round(performance.now() - ttfbStart);
      const formatted = await formatResponse(followed, startTime, followed.redirected ? 'GET' : currentMethod);
      formatted.redirects = redirects;
      formatted.finalUrl = followed.url;
      formatted.timings = {
        total: formatted.time,
        ttfb,
        download: Math.max(0, formatted.time - ttfb),
      };
      return formatted;
    }

    const isRedirect = [301, 302, 303, 307, 308].includes(response.status) && location;
    if (isRedirect && followRedirects) {
      await response.arrayBuffer().catch(() => {});
      currentUrl = new URL(location, currentUrl).href;
      if ([301, 302, 303].includes(response.status)) {
        currentMethod = 'GET';
        currentBody = { body: null, multipart: null, binaryBody: null };
      }
      continue;
    }

    const ttfb = Math.round(performance.now() - ttfbStart);
    const formatted = await formatResponse(response, startTime, currentMethod);
    formatted.redirects = redirects;
    formatted.finalUrl = currentUrl;
    formatted.timings = {
      total: formatted.time,
      ttfb,
      download: Math.max(0, formatted.time - ttfb),
    };
    return formatted;
  }

  return errorResult('Too many redirects');
}

async function formatResponse(response, startTime, method = 'GET') {
  const time = Math.round(performance.now() - startTime);
  const responseHeaders = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = responseHeaders[key] ? `${responseHeaders[key]}, ${value}` : value;
  });

  if (response.status === 204 || method === 'HEAD') {
    return {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: '',
      time,
      size: 0,
      ok: response.ok,
      truncated: false,
    };
  }

  const buffer = await response.arrayBuffer();
  const size = buffer.byteLength;
  const truncated = size > MAX_RESPONSE_BYTES;
  const slice = truncated ? buffer.slice(0, MAX_RESPONSE_BYTES) : buffer;
  const contentType = response.headers.get('content-type') || '';
  const mime = String(contentType).split(';')[0].trim().toLowerCase();
  const isImage = mime.startsWith('image/');
  let bodyBase64 = '';
  let responseBody = '';
  if (isImage) {
    bodyBase64 = arrayBufferToBase64(slice);
    responseBody = `[image ${mime || 'image'}, ${size} bytes]`;
  } else {
    responseBody = new TextDecoder('utf-8', { fatal: false }).decode(slice);
    if (!truncated && mime.includes('json') && responseBody.trim()) {
      try {
        responseBody = JSON.stringify(JSON.parse(responseBody), null, 2);
      } catch {
        /* keep raw */
      }
    } else if (!truncated && /xml|html/.test(mime)) {
      responseBody = prettyXml(responseBody);
    }
  }

  if (truncated && !isImage) {
    responseBody += `\n\n[truncated: response is ${size} bytes, showing first ${MAX_RESPONSE_BYTES}]`;
  }

  return {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
    body: responseBody,
    bodyBase64,
    time,
    size,
    ok: response.ok,
    truncated,
    contentType,
  };
}

function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function prettyXml(xml) {
  try {
    const padded = xml.replace(/>(\s*)</g, '>$1\n<');
    const lines = padded.split('\n').map((l) => l.trim()).filter(Boolean);
    let indent = 0;
    return lines.map((line) => {
      if (line.startsWith('</')) indent = Math.max(indent - 1, 0);
      const out = `${'  '.repeat(indent)}${line}`;
      if (line.startsWith('<') && !line.startsWith('</') && !line.startsWith('<?') && !line.endsWith('/>') && !line.includes('</')) {
        indent += 1;
      }
      return out;
    }).join('\n');
  } catch {
    return xml;
  }
}

async function fetchWithDigest({ method, url, headers, body, multipart, digest, signal, followRedirects, binaryBody }) {
  const startTime = performance.now();
  const first = await fetch(url, {
    method,
    headers: { ...(headers || {}) },
    body: method !== 'GET' && method !== 'HEAD' ? body : undefined,
    signal,
    redirect: 'manual',
  });
  const raw = await first.text();
  const challenge = digestChallengeFrom(first.headers, raw);
  if (first.status !== 401 || !challenge?.nonce) {
    return formatRawResponse(first, raw, startTime);
  }

  const uri = new URL(url).pathname + new URL(url).search;
  const authorization = buildDigestHeader({
    challenge,
    username: digest.username,
    password: digest.password || '',
    method,
    uri,
  });

  return performFetch({
    method,
    url,
    headers,
    body,
    multipart,
    signal,
    extraHeaders: { 'X-Digest-Authorization': authorization },
    followRedirects,
    binaryBody,
  });
}

function digestChallengeFrom(headers, raw) {
  const discrete = {
    realm: headers.get('x-digest-realm'),
    nonce: headers.get('x-digest-nonce'),
    opaque: headers.get('x-digest-opaque'),
    qop: headers.get('x-digest-qop') || 'auth',
    algorithm: 'MD5',
  };
  if (discrete.nonce && discrete.realm) return discrete;

  const header = headers.get('x-www-authenticate') || headers.get('www-authenticate') || '';
  const fromHeader = parseDigestChallenge(header);
  if (fromHeader?.nonce) return fromHeader;

  try {
    const json = JSON.parse(raw);
    if (json.nonce && json.realm) {
      return {
        realm: json.realm,
        nonce: json.nonce,
        opaque: json.opaque,
        qop: json.qop || 'auth',
        algorithm: json.algorithm || 'MD5',
      };
    }
    if (json.challenge) return parseDigestChallenge(json.challenge);
  } catch {
    /* ignore */
  }
  return null;
}

function formatRawResponse(response, raw, startTime) {
  const time = Math.round(performance.now() - startTime);
  const responseHeaders = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = responseHeaders[key] ? `${responseHeaders[key]}, ${value}` : value;
  });
  return {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
    body: raw,
    time,
    size: new Blob([raw]).size,
    ok: response.ok,
    truncated: false,
    contentType: response.headers.get('content-type') || '',
  };
}

function parseDigestChallenge(header) {
  if (!header) return null;
  const params = {};
  const cleaned = String(header).replace(/^Digest\s+/i, '');
  const regex = /(\w+)=(?:"([^"]*)"|([^\s,]+))/g;
  let match;
  while ((match = regex.exec(cleaned)) !== null) {
    params[match[1]] = match[2] ?? match[3];
  }
  return params.nonce ? params : null;
}

function buildDigestHeader({ challenge, username, password, method, uri }) {
  const realm = challenge.realm || '';
  const nonce = challenge.nonce || '';
  const qop = (challenge.qop || '').split(',')[0].trim();
  const opaque = challenge.opaque;
  const algorithm = challenge.algorithm || 'MD5';
  const nc = '00000001';
  const cnonce = md5Hex(String(Math.random())).slice(0, 16);

  const ha1 = md5Hex(`${username}:${realm}:${password}`);
  const ha2 = md5Hex(`${method}:${uri}`);
  const response = qop
    ? md5Hex(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
    : md5Hex(`${ha1}:${nonce}:${ha2}`);

  const parts = [
    `username="${username}"`,
    `realm="${realm}"`,
    `nonce="${nonce}"`,
    `uri="${uri}"`,
    `algorithm="${algorithm}"`,
    `response="${response}"`,
  ];
  if (qop) {
    parts.push(`qop=${qop}`, `nc=${nc}`, `cnonce="${cnonce}"`);
  }
  if (opaque) parts.push(`opaque="${opaque}"`);
  return `Digest ${parts.join(', ')}`;
}

function errorResult(message, statusText = 'Network Error') {
  return {
    error: message,
    status: 0,
    statusText,
    body: `Error: ${message}`,
    time: 0,
    size: 0,
    ok: false,
  };
}

function md5Hex(str) {
  return md5Bytes(unescape(encodeURIComponent(str)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function md5Bytes(str) {
  function cmn(q, a, b, x, s, t) {
    a = add32(add32(a, q), add32(x, t));
    return add32((a << s) | (a >>> (32 - s)), b);
  }
  function ff(a, b, c, d, x, s, t) {
    return cmn((b & c) | (~b & d), a, b, x, s, t);
  }
  function gg(a, b, c, d, x, s, t) {
    return cmn((b & d) | (c & ~d), a, b, x, s, t);
  }
  function hh(a, b, c, d, x, s, t) {
    return cmn(b ^ c ^ d, a, b, x, s, t);
  }
  function ii(a, b, c, d, x, s, t) {
    return cmn(c ^ (b | ~d), a, b, x, s, t);
  }
  function add32(a, b) {
    return (a + b) & 0xffffffff;
  }

  const n = str.length;
  const state = [1732584193, -271733879, -1732584194, 271733878];
  let i;
  for (i = 64; i <= n; i += 64) {
    md5cycle(state, md5blk(str.substring(i - 64, i)));
  }
  str = str.substring(i - 64);
  const tail = new Array(16).fill(0);
  for (i = 0; i < str.length; i++) tail[i >> 2] |= str.charCodeAt(i) << ((i % 4) << 3);
  tail[i >> 2] |= 0x80 << ((i % 4) << 3);
  if (i > 55) {
    md5cycle(state, tail);
    for (let j = 0; j < 16; j++) tail[j] = 0;
  }
  tail[14] = n * 8;
  md5cycle(state, tail);

  const out = [];
  for (i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) out.push((state[i] >>> (j * 8)) & 255);
  }
  return out;

  function md5blk(s) {
    const md5blks = [];
    for (let k = 0; k < 64; k += 4) {
      md5blks[k >> 2] =
        s.charCodeAt(k) +
        (s.charCodeAt(k + 1) << 8) +
        (s.charCodeAt(k + 2) << 16) +
        (s.charCodeAt(k + 3) << 24);
    }
    return md5blks;
  }

  function md5cycle(x, k) {
    let [a, b, c, d] = x;
    a = ff(a, b, c, d, k[0], 7, -680876936);
    d = ff(d, a, b, c, k[1], 12, -389564586);
    c = ff(c, d, a, b, k[2], 17, 606105819);
    b = ff(b, c, d, a, k[3], 22, -1044525330);
    a = ff(a, b, c, d, k[4], 7, -176418897);
    d = ff(d, a, b, c, k[5], 12, 1200080426);
    c = ff(c, d, a, b, k[6], 17, -1473231341);
    b = ff(b, c, d, a, k[7], 22, -45705983);
    a = ff(a, b, c, d, k[8], 7, 1770035416);
    d = ff(d, a, b, c, k[9], 12, -1958414417);
    c = ff(c, d, a, b, k[10], 17, -42063);
    b = ff(b, c, d, a, k[11], 22, -1990404162);
    a = ff(a, b, c, d, k[12], 7, 1804603682);
    d = ff(d, a, b, c, k[13], 12, -40341101);
    c = ff(c, d, a, b, k[14], 17, -1502002290);
    b = ff(b, c, d, a, k[15], 22, 1236535329);
    a = gg(a, b, c, d, k[1], 5, -165796510);
    d = gg(d, a, b, c, k[6], 12, -1069501632);
    c = gg(c, d, a, b, k[11], 17, 643717713);
    b = gg(b, c, d, a, k[0], 22, -373897302);
    a = gg(a, b, c, d, k[5], 5, -701558691);
    d = gg(d, a, b, c, k[10], 12, 38016083);
    c = gg(c, d, a, b, k[15], 17, -660478335);
    b = gg(b, c, d, a, k[4], 22, -405537848);
    a = gg(a, b, c, d, k[9], 5, 568446438);
    d = gg(d, a, b, c, k[14], 12, -1019803690);
    c = gg(c, d, a, b, k[3], 17, -187363961);
    b = gg(b, c, d, a, k[8], 22, 1163531501);
    a = gg(a, b, c, d, k[13], 5, -1444681467);
    d = gg(d, a, b, c, k[2], 12, -51403784);
    c = gg(c, d, a, b, k[7], 17, 1735328473);
    b = gg(b, c, d, a, k[12], 22, -1926607734);
    a = hh(a, b, c, d, k[5], 4, -378558);
    d = hh(d, a, b, c, k[8], 11, -2022574463);
    c = hh(c, d, a, b, k[11], 16, 1839030562);
    b = hh(b, c, d, a, k[14], 23, -35309556);
    a = hh(a, b, c, d, k[1], 4, -1530992060);
    d = hh(d, a, b, c, k[4], 11, 1272893353);
    c = hh(c, d, a, b, k[7], 16, -155497632);
    b = hh(b, c, d, a, k[10], 23, -1094730640);
    a = hh(a, b, c, d, k[13], 4, 681279174);
    d = hh(d, a, b, c, k[0], 11, -358537222);
    c = hh(c, d, a, b, k[3], 16, -722521979);
    b = hh(b, c, d, a, k[6], 23, 76029189);
    a = hh(a, b, c, d, k[9], 4, -640364487);
    d = hh(d, a, b, c, k[12], 11, -421815835);
    c = hh(c, d, a, b, k[15], 16, 530742520);
    b = hh(b, c, d, a, k[2], 23, -995338651);
    a = ii(a, b, c, d, k[0], 6, -198630844);
    d = ii(d, a, b, c, k[7], 10, 1126891415);
    c = ii(c, d, a, b, k[14], 15, -1416354905);
    b = ii(b, c, d, a, k[5], 21, -57434055);
    a = ii(a, b, c, d, k[12], 6, 1700485571);
    d = ii(d, a, b, c, k[3], 10, -1894986606);
    c = ii(c, d, a, b, k[10], 15, -1051523);
    b = ii(b, c, d, a, k[1], 21, -2054922799);
    a = ii(a, b, c, d, k[8], 6, 1873313359);
    d = ii(d, a, b, c, k[15], 10, -30611744);
    c = ii(c, d, a, b, k[6], 15, -1560198380);
    b = ii(b, c, d, a, k[13], 21, 1309151649);
    a = ii(a, b, c, d, k[4], 6, -145523070);
    d = ii(d, a, b, c, k[11], 10, -1120210379);
    c = ii(c, d, a, b, k[2], 15, 718787259);
    b = ii(b, c, d, a, k[9], 21, -343485551);
    x[0] = add32(a, x[0]);
    x[1] = add32(b, x[1]);
    x[2] = add32(c, x[2]);
    x[3] = add32(d, x[3]);
  }
}
