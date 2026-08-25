import { describe, expect, it } from 'vitest';
import {
  FREE_AUTH,
  FREE_BODY,
  FREE_TAB_LIMIT,
  historyLimitFor,
  PRO_FEATURES,
} from '../../modules/entitlements.js';

describe('entitlements', () => {
  it('keeps Free auth and body sets tight', () => {
    expect(FREE_AUTH.has('bearer')).toBe(true);
    expect(FREE_AUTH.has('digest')).toBe(false);
    expect(FREE_BODY.has('json')).toBe(true);
    expect(FREE_BODY.has('graphql')).toBe(false);
    expect(FREE_TAB_LIMIT).toBe(1);
  });

  it('raises history cap for Pro', () => {
    expect(historyLimitFor(false)).toBe(50);
    expect(historyLimitFor(true)).toBe(2000);
  });

  it('maps Pro features to UI ids', () => {
    expect(PRO_FEATURES.importCollections).toBe('importAnyBtn');
    expect(PRO_FEATURES.websocket).toBe('websocketBtn');
  });
});
