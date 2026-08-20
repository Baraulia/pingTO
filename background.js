const DEFAULT_TIMEOUT_MS = 30000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const inflight = new Map();

const APP_PATH = 'app.html';
let appWindowId = null;

function appUrl() {
  return chrome.runtime.getURL(APP_PATH);
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

async function openAppWindow() {
  const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (active?.windowId) await closeSidePanel(active.windowId);

  if (appWindowId != null) {
    try {
      await chrome.windows.update(appWindowId, { focused: true });
      return;
    } catch {
      appWindowId = null;
    }
  }

  const existing = await chrome.tabs.query({ url: `${appUrl()}*` });
  for (const tab of existing) {
    try {
      const win = await chrome.windows.get(tab.windowId);
      if (win.type === 'popup') {
        appWindowId = win.id;
        await chrome.windows.update(win.id, { focused: true });
        return;
      }
    } catch {
      /* keep looking */
    }
  }

  const created = await chrome.windows.create({
    url: appUrl(),
    type: 'popup',
    width: 1280,
    height: 860,
    focused: true,
  });
  appWindowId = created.id ?? null;
}

async function openFullscreen(senderWindowId) {
  await closeSidePanel(senderWindowId);

  let senderWin = null;
  if (senderWindowId) {
    try {
      senderWin = await chrome.windows.get(senderWindowId);
    } catch {
      senderWin = null;
    }
  }

  if (senderWin?.type === 'popup') {
    await chrome.windows.update(senderWindowId, { state: 'maximized', focused: true });
    return;
  }

  await openAppWindow();
  if (appWindowId != null) {
    try {
      await chrome.windows.update(appWindowId, { state: 'maximized', focused: true });
    } catch {
      /* ignore */
    }
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
  if (id === appWindowId) appWindowId = null;
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
  if (message.type === 'openFullscreen') {
    openFullscreen(sender.tab?.windowId).then(() => sendResponse({ ok: true }));
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
    if (digest?.username) {
      return await fetchWithDigest({
        method,
        url,
        headers,
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
      headers,
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

  if (binaryBody?.base64) {
    const bytes = Uint8Array.from(atob(binaryBody.base64), (c) => c.charCodeAt(0));
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
    redirects.push({ url: currentUrl, status: response.status, location });

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
  let responseBody = new TextDecoder('utf-8', { fatal: false }).decode(slice);

  const contentType = response.headers.get('content-type') || '';
  if (!truncated && contentType.includes('json') && responseBody.trim()) {
    try {
      responseBody = JSON.stringify(JSON.parse(responseBody), null, 2);
    } catch {
      /* keep raw */
    }
  } else if (!truncated && /xml|html/.test(contentType)) {
    responseBody = prettyXml(responseBody);
  }

  if (truncated) {
    responseBody += `\n\n[truncated: response is ${size} bytes, showing first ${MAX_RESPONSE_BYTES}]`;
  }

  return {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
    body: responseBody,
    time,
    size,
    ok: response.ok,
    truncated,
    contentType,
  };
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

async function fetchWithDigest({ method, url, headers, body, multipart, digest, signal }) {
  const startTime = performance.now();
  const first = await fetch(url, {
    method,
    headers: { ...(headers || {}) },
    body: method !== 'GET' && method !== 'HEAD' ? body : undefined,
    signal,
    redirect: 'follow',
  });

  const authHeader = first.headers.get('www-authenticate') || '';
  if (first.status !== 401 || !/digest/i.test(authHeader)) {
    return formatResponse(first, startTime, method);
  }
  await first.arrayBuffer().catch(() => {});

  const challenge = parseDigestChallenge(authHeader);
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
    extraHeaders: { Authorization: authorization },
  });
}

function parseDigestChallenge(header) {
  const params = {};
  const cleaned = header.replace(/^Digest\s+/i, '');
  const regex = /(\w+)=(?:"([^"]*)"|([^\s,]+))/g;
  let match;
  while ((match = regex.exec(cleaned)) !== null) {
    params[match[1]] = match[2] ?? match[3];
  }
  return params;
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
