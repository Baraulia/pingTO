import { describe, expect, it } from 'vitest';
import {
  FREE_AUTH,
  FREE_BODY,
  FREE_COLLECTION_LIMIT,
  FREE_ENV_LIMIT,
  FREE_ENV_VAR_LIMIT,
  FREE_REQUEST_LIMIT,
  canAddCollection,
  canAddEnvVar,
  canAddEnvironment,
  canAddRequest,
  hasActiveLicense,
  historyLimitFor,
  isCollectionUnlocked,
  isUnpackedInstall,
  PRO_FEATURES,
  resolveIsPro,
  unlockedCollectionIds,
  savedRequestCount,
  isProImportFormat,
  freeImportBlock,
} from '../../modules/entitlements.js';

describe('entitlements', () => {
  it('keeps Free auth and body sets tight', () => {
    expect(FREE_AUTH.has('bearer')).toBe(true);
    expect(FREE_AUTH.has('inherit')).toBe(true);
    expect(FREE_AUTH.has('apikey')).toBe(true);
    expect(FREE_AUTH.has('digest')).toBe(false);
    expect(FREE_BODY.has('json')).toBe(true);
    expect(FREE_BODY.has('multipart')).toBe(true);
    expect(FREE_BODY.has('graphql')).toBe(false);
  });

  it('caps Free collections, requests and environments', () => {
    expect(FREE_COLLECTION_LIMIT).toBe(2);
    expect(FREE_REQUEST_LIMIT).toBe(25);
    expect(FREE_ENV_LIMIT).toBe(1);
    expect(FREE_ENV_VAR_LIMIT).toBe(10);
    expect(canAddCollection(false, 1)).toBe(true);
    expect(canAddCollection(false, 2)).toBe(false);
    expect(canAddRequest(false, 24)).toBe(true);
    expect(canAddRequest(false, 25)).toBe(false);
    expect(canAddEnvironment(false, 0)).toBe(true);
    expect(canAddEnvironment(false, 1)).toBe(false);
    expect(canAddEnvVar(false, 9)).toBe(true);
    expect(canAddEnvVar(true, 99)).toBe(true);
  });

  it('raises history cap for Pro', () => {
    expect(historyLimitFor(false)).toBe(50);
    expect(historyLimitFor(true)).toBe(2000);
  });

  it('maps Pro features to UI ids', () => {
    expect(PRO_FEATURES.importCollections).toBe('importAnyBtn');
    expect(PRO_FEATURES.bruno).toBe('fmtBruno');
    expect(PRO_FEATURES.loadtest).toBe('loadtestBtn');
    expect(PRO_FEATURES.workspaceSync).toBe('exportWorkspaceBtn');
  });

  it('keeps extra Free collections locked instead of deleting them', () => {
    const cols = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(unlockedCollectionIds(true, cols)).toEqual(['a', 'b', 'c']);
    expect(unlockedCollectionIds(false, cols)).toEqual(['a', 'b']);
    expect(isCollectionUnlocked(false, cols, 'c')).toBe(false);
    expect(isCollectionUnlocked(false, cols, 'a')).toBe(true);
    expect(isCollectionUnlocked(true, cols, 'c')).toBe(true);
  });

  it('does not treat storage isPro as a license in the store build', () => {
    expect(isUnpackedInstall({})).toBe(true);
    expect(isUnpackedInstall({ update_url: 'https://clients2.google.com/service/update2/crx' })).toBe(false);
    expect(resolveIsPro({ unpacked: false, licensed: false, storedDev: true })).toBe(false);
    expect(resolveIsPro({ unpacked: true, licensed: false, storedDev: true })).toBe(true);
    expect(resolveIsPro({ unpacked: false, licensed: true, storedDev: false })).toBe(true);
    expect(hasActiveLicense({ key: 'x', status: 'active' })).toBe(true);
    expect(hasActiveLicense({ key: 'x', status: 'expired' })).toBe(false);
    expect(hasActiveLicense({})).toBe(false);
  });

  it('blocks Free imports that exceed collection or request caps', () => {
    expect(isProImportFormat('pingto')).toBe(false);
    expect(isProImportFormat('postman')).toBe(true);
    expect(freeImportBlock(true, [], [{ items: [{ type: 'request' }] }])).toBeNull();
    const two = [{ id: 'a', items: [] }, { id: 'b', items: [] }];
    expect(freeImportBlock(false, two, [{ id: 'c', items: [] }])).toBe('freeImportCollections');
    const fat = [{ id: 'x', items: Array.from({ length: 26 }, (_, i) => ({ type: 'request', id: String(i) })) }];
    expect(savedRequestCount(fat)).toBe(26);
    expect(freeImportBlock(false, [], fat)).toBe('freeImportRequests');
    const ok = [{ id: 'x', items: Array.from({ length: 2 }, (_, i) => ({ type: 'request', id: String(i) })) }];
    expect(freeImportBlock(false, [], ok)).toBeNull();
  });
});
