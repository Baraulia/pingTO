import { describe, expect, it } from 'vitest';
import {
  addItem,
  emptyRequest,
  findItem,
  findParentId,
  ancestorFolderIds,
  flattenRequests,
  flattenRequestsInScope,
  moveItem,
  normalizeCollection,
  removeItem,
  searchRequests,
} from '../../modules/collection-tree.js';

describe('collection-tree', () => {
  it('normalizes items and legacy requests', () => {
    const coll = normalizeCollection({
      name: 'A',
      requests: [{ name: 'R', method: 'GET', url: 'http://x' }],
    });
    expect(coll.items).toHaveLength(1);
    expect(coll.items[0].type).toBe('request');
    expect(emptyRequest({ name: 'N' }).name).toBe('N');
  });

  it('does not keep shared references when opening a request', () => {
    const headers = [{ key: 'X', value: '1' }];
    const auth = { token: 'abc' };
    const req = emptyRequest({ name: 'N', headers, auth, params: [{ key: 'q', value: '1' }] });
    req.headers[0].value = 'changed';
    req.auth.token = 'zzz';
    req.params[0].value = '2';
    expect(headers[0].value).toBe('1');
    expect(auth.token).toBe('abc');
  });

  it('adds, finds, flattens and removes nested items', () => {
    const items = [];
    addItem(items, null, { type: 'folder', id: 'f1', name: 'F', items: [] });
    addItem(items, 'f1', emptyRequest({ id: 'r1', name: 'inside' }));
    expect(findItem(items, 'r1').name).toBe('inside');
    expect(findParentId(items, 'r1')).toBe('f1');
    expect(ancestorFolderIds(items, 'r1')).toEqual(['f1']);
    expect(flattenRequests(items)).toHaveLength(1);
    expect(flattenRequestsInScope(items, 'f1')).toHaveLength(1);
    expect(removeItem(items, 'r1')).toBe(true);
    expect(findItem(items, 'r1')).toBeNull();
  });

  it('moves a request between folders', () => {
    const items = [
      { type: 'folder', id: 'a', name: 'A', items: [emptyRequest({ id: 'r', name: 'R' })] },
      { type: 'folder', id: 'b', name: 'B', items: [] },
    ];
    expect(moveItem(items, 'r', 'b')).toBe(true);
    expect(findParentId(items, 'r')).toBe('b');
    expect(flattenRequestsInScope(items, 'a')).toHaveLength(0);
    expect(flattenRequestsInScope(items, 'b')).toHaveLength(1);
  });

  it('lists all ancestor folders of a nested request', () => {
    const items = [
      {
        type: 'folder',
        id: 'a',
        name: 'A',
        items: [{ type: 'folder', id: 'b', name: 'B', items: [emptyRequest({ id: 'r', name: 'R' })] }],
      },
    ];
    expect(ancestorFolderIds(items, 'r')).toEqual(['a', 'b']);
    expect(ancestorFolderIds(items, 'missing')).toEqual([]);
  });

  it('searches by name and method', () => {
    const hits = searchRequests(
      [{ name: 'C', items: [emptyRequest({ name: 'Health', method: 'GET', url: '/health' })] }],
      'hea'
    );
    expect(hits).toHaveLength(1);
  });
});
