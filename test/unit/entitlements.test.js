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
  historyLimitFor,
  PRO_FEATURES,
} from '../../modules/entitlements.js';

describe('entitlements', () => {
  it('keeps Free auth and body sets tight', () => {
    expect(FREE_AUTH.has('bearer')).toBe(true);
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
  });
});
