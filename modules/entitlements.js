export const FREE_HISTORY_LIMIT = 50;
export const PRO_HISTORY_LIMIT = 2000;
export const FREE_COLLECTION_LIMIT = 2;
export const FREE_REQUEST_LIMIT = 25;
export const FREE_ENV_LIMIT = 1;
export const FREE_ENV_VAR_LIMIT = 10;

export const PRO_FEATURES = {
  collections: 'tabCollections',
  environments: 'tabEnvironments',
  graphql: 'graphqlTab',
  websocket: 'websocketBtn',
  codegen: 'generateCodeBtn',
  scripts: 'scriptsTab',
  oauth: 'authOauth2',
  digest: 'authDigest',
  snapshots: 'snapshotBtn',
  testsResp: 'testsTab',
  diff: 'diffTab',
  binary: 'bodyTypeBinary',
  historyCap: 'proHistoryHint',
  collectionRun: 'runCollectionBtn',
  bruno: 'fmtBruno',
  importCollections: 'importAnyBtn',
  loadtest: 'loadtestBtn',
};

export const FREE_AUTH = new Set(['none', 'bearer', 'basic', 'apikey']);
export const FREE_BODY = new Set(['none', 'json', 'form', 'text', 'multipart']);
export const FREE_REQ_PANES = new Set(['params', 'headers', 'body', 'auth', 'curl', 'cookies', 'docs']);
export const FREE_RESP_PANES = new Set(['body', 'pretty', 'headers', 'preview', 'redirects', 'filter']);
export const PRO_AUTH = new Set(['digest', 'oauth2']);

export function isUnpackedInstall(manifest) {
  const m = manifest ?? (typeof chrome !== 'undefined' ? chrome.runtime?.getManifest?.() : null);
  if (!m) return true;
  return !Object.prototype.hasOwnProperty.call(m, 'update_url');
}

export function hasActiveLicense(license) {
  if (!license || typeof license !== 'object') return false;
  if (!String(license.key || '').trim()) return false;
  if (license.status && license.status !== 'active') return false;
  if (license.expiresAt && Number(license.expiresAt) < Date.now()) return false;
  return true;
}

/** Store builds ignore chrome.storage isPro. Unpacked (Load unpacked) may use the dev toggle. */
export function resolveIsPro({ unpacked, licensed, storedDev } = {}) {
  if (licensed) return true;
  if (unpacked) return Boolean(storedDev);
  return false;
}

export function historyLimitFor(isPro) {
  return isPro ? PRO_HISTORY_LIMIT : FREE_HISTORY_LIMIT;
}

export function canAddCollection(isPro, count) {
  return isPro || count < FREE_COLLECTION_LIMIT;
}

export function canAddRequest(isPro, count) {
  return isPro || count < FREE_REQUEST_LIMIT;
}

export function canAddEnvironment(isPro, count) {
  return isPro || count < FREE_ENV_LIMIT;
}

export function canAddEnvVar(isPro, count) {
  return isPro || count < FREE_ENV_VAR_LIMIT;
}

export function unlockedCollectionIds(isPro, collections) {
  const list = collections || [];
  if (isPro) return list.map((c) => String(c.id));
  return list.slice(0, FREE_COLLECTION_LIMIT).map((c) => String(c.id));
}

export function isCollectionUnlocked(isPro, collections, collectionId) {
  if (isPro) return true;
  return unlockedCollectionIds(false, collections).includes(String(collectionId));
}
