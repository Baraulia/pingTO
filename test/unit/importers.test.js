import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { detectAndImport, importOpenApi, importPostman } from '../../modules/importers.js';

const testdCollection = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../testd/pingto-testd-collection.json'), 'utf8')
);

describe('importers', () => {
  it('imports native pingto testd collection', () => {
    const list = detectAndImport(testdCollection);
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('PingTo testd');
    const ids = [];
    const walk = (items) => {
      (items || []).forEach((item) => {
        if (item.type === 'folder') walk(item.items);
        else ids.push(item.id);
      });
    };
    walk(list[0].items);
    expect(ids).toContain('testd-health');
    expect(ids).toContain('testd-ws');
    expect(ids.length).toBeGreaterThan(30);
  });

  it('imports Postman v2', () => {
    const list = importPostman({
      info: { name: 'PM' },
      item: [
        {
          name: 'Folder',
          item: [
            {
              name: 'Get user',
              request: {
                method: 'GET',
                header: [{ key: 'Accept', value: 'application/json' }],
                url: 'http://x/users/1',
              },
            },
          ],
        },
      ],
    });
    expect(list[0].items[0].type).toBe('folder');
    expect(list[0].items[0].items[0].url).toBe('http://x/users/1');
  });

  it('imports OpenAPI paths', () => {
    const list = importOpenApi({
      openapi: '3.0.0',
      info: { title: 'Demo' },
      servers: [{ url: 'http://api' }],
      paths: {
        '/ping': {
          get: { summary: 'Ping', tags: ['ops'] },
        },
      },
    });
    expect(list[0].items[0].name).toBe('ops');
    expect(list[0].items[0].items[0].url).toBe('http://api/ping');
  });

  it('imports Bruno meta blocks', () => {
    const list = detectAndImport('meta {\n  name: BruReq\n}\nhttp {\n  method: POST\n  url: http://x/json\n}\nbody:json {\n{"a":1}\n}');
    expect(list[0].items[0].method).toBe('POST');
    expect(list[0].items[0].body).toContain('"a":1');
  });

  it('rejects unknown JSON', () => {
    expect(() => detectAndImport({ foo: 1 })).toThrow(/Unknown collection format/);
  });
});
