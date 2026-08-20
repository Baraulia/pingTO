export const FREE_HISTORY_LIMIT = 50;
export const PRO_HISTORY_LIMIT = 2000;
export const FREE_TAB_LIMIT = 1;

export const PRO_FEATURES = {
  collections: 'tabCollections',
  environments: 'tabEnvironments',
  graphql: 'graphqlTab',
  websocket: 'websocketBtn',
  codegen: 'generateCodeBtn',
  scripts: 'scriptsTab',
  cookies: 'cookiesTab',
  docs: 'docsTab',
  oauth: 'authOauth2',
  digest: 'authDigest',
  apikey: 'authApiKey',
  snapshots: 'snapshotBtn',
  jsonpath: 'jsonPathTab',
  testsResp: 'testsTab',
  diff: 'diffTab',
  binary: 'bodyTypeBinary',
  extraTabs: 'cmdNewTab',
  historyCap: 'proHistoryHint',
  collectionRun: 'runCollectionBtn',
  bruno: 'exportBruBtn',
  importCollections: 'importAnyBtn',
};

export const FREE_AUTH = new Set(['none', 'bearer', 'basic']);
export const FREE_BODY = new Set(['none', 'json', 'form', 'text']);
export const FREE_REQ_PANES = new Set(['params', 'headers', 'body', 'auth', 'curl']);
export const FREE_RESP_PANES = new Set(['body', 'pretty', 'headers', 'preview', 'redirects']);
export const PRO_AUTH = new Set(['digest', 'apikey', 'oauth2']);

export function historyLimitFor(isPro) {
  return isPro ? PRO_HISTORY_LIMIT : FREE_HISTORY_LIMIT;
}
