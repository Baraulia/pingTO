import { describe, expect, it } from 'vitest';
import { resolveInheritedAuth } from '../../modules/auth-inherit.js';
import { emptyRequest, normalizeCollection } from '../../modules/collection-tree.js';

const coll = {
  id: 'c1',
  name: 'API',
  authType: 'bearer',
  auth: { token: 'col' },
  items: [
    {
      type: 'folder',
      id: 'f1',
      name: 'Users',
      authType: 'inherit',
      auth: {},
      items: [
        emptyRequest({ id: 'r1', name: 'Me', authType: 'inherit', url: 'http://x/me' }),
        emptyRequest({ id: 'r2', name: 'Open', authType: 'none', url: 'http://x/open' }),
      ],
    },
    {
      type: 'folder',
      id: 'f2',
      name: 'Admin',
      authType: 'basic',
      auth: { user: 'a', pass: 'b' },
      items: [emptyRequest({ id: 'r3', name: 'Staff', authType: 'inherit', url: 'http://x/admin' })],
    },
  ],
};

describe('auth inherit', () => {
  it('uses collection bearer through inheriting folders and requests', () => {
    const r = resolveInheritedAuth(coll, 'r1', coll.items[0].items[0]);
    expect(r.authType).toBe('bearer');
    expect(r.auth.token).toBe('col');
  });

  it('request none overrides collection auth', () => {
    const r = resolveInheritedAuth(coll, 'r2', coll.items[0].items[1]);
    expect(r.authType).toBe('none');
  });

  it('folder auth overrides collection', () => {
    const r = resolveInheritedAuth(coll, 'r3', coll.items[1].items[0]);
    expect(r.authType).toBe('basic');
    expect(r.auth.user).toBe('a');
  });

  it('unsaved inherit uses selected folder', () => {
    const tab = { authType: 'inherit', auth: {} };
    const r = resolveInheritedAuth(coll, null, tab, { folderId: 'f2' });
    expect(r.authType).toBe('basic');
  });

  it('normalizeCollection keeps folder and collection auth', () => {
    const n = normalizeCollection(coll);
    expect(n.authType).toBe('bearer');
    expect(n.items[0].authType).toBe('inherit');
    expect(n.items[1].authType).toBe('basic');
  });
});
