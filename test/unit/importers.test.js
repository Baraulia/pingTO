import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { detectAndImport, importHar, importOpenApi, importPostman, isNativePingto } from '../../modules/importers.js';

const testdCollection = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../ToDelete/pingto-testd-collection.json'), 'utf8')
);

describe('importers', () => {
  it('imports native pingto testd collection', () => {
    const list = detectAndImport(testdCollection);
    expect(list).toHaveLength(2);
    expect(list[0].name).toBe('PingTo testd');
    expect(list[1].name).toBe('PingTo testd runner');
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
    expect(ids).toContain('testd-auth-bearer-nested');
    expect(ids.length).toBeGreaterThan(30);
    const runner = [];
    const walkRunner = (items) => {
      (items || []).forEach((item) => {
        if (item.type === 'folder') walkRunner(item.items);
        else runner.push(item.id);
      });
    };
    walkRunner(list[1].items);
    expect(runner).toContain('testd-run-query');
    expect(runner).toContain('testd-run-echo');
    const authFolder = list[0].items.find((item) => item.id === 'testd-folder-auth');
    expect(authFolder.authType).toBe('bearer');
    const bearer = authFolder.items.find((item) => item.id === 'testd-auth-bearer');
    expect(bearer.authType).toBe('inherit');
  });

  it('detects native pingto JSON', () => {
    expect(isNativePingto(testdCollection)).toBe(true);
    expect(isNativePingto({ info: { name: 'PM' }, item: [] })).toBe(false);
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

  it('imports Postman collection bearer auth onto folders and inherit on requests', () => {
    const list = importPostman({
      info: { name: 'PM' },
      auth: { type: 'bearer', bearer: [{ key: 'token', value: 'tok' }] },
      item: [
        {
          name: 'Get user',
          request: {
            method: 'GET',
            url: 'http://x/me',
          },
        },
      ],
    });
    expect(list[0].authType).toBe('bearer');
    expect(list[0].auth.token).toBe('tok');
    expect(list[0].items[0].authType).toBe('inherit');
  });

  it('imports HAR http entries and skips chrome-extension', () => {
    const list = importHar({
      log: {
        creator: { name: 'Chrome' },
        entries: [
          { request: { method: 'GET', url: 'https://api.example/ping', headers: [{ name: 'Accept', value: 'json' }] } },
          { request: { method: 'GET', url: 'chrome-extension://abc/app.html' } },
        ],
      },
    });
    expect(list[0].items).toHaveLength(1);
    expect(list[0].items[0].url).toBe('https://api.example/ping');
    expect(list[0].items[0].method).toBe('GET');
  });

  it('maps HAR Bearer and drops hop-by-hop headers', () => {
    const list = importHar({
      log: {
        entries: [{
          request: {
            method: 'GET',
            url: 'https://api.example/me',
            headers: [
              { name: 'Host', value: 'api.example' },
              { name: 'Authorization', value: 'Bearer secret-token' },
              { name: 'Accept', value: 'application/json' },
            ],
          },
        }],
      },
    });
    const req = list[0].items[0];
    expect(req.authType).toBe('bearer');
    expect(req.auth.token).toBe('secret-token');
    expect(req.headers.some((h) => h.key.toLowerCase() === 'host')).toBe(false);
    expect(req.headers.some((h) => h.key.toLowerCase() === 'authorization')).toBe(false);
    expect(req.headers.some((h) => h.key === 'Accept')).toBe(true);
  });

  it('detects HAR JSON', () => {
    const list = detectAndImport({
      log: { entries: [{ request: { method: 'POST', url: 'https://x/a', postData: { mimeType: 'application/json', text: '{"a":1}' } } }] },
    });
    expect(list[0].items[0].bodyType).toBe('json');
    expect(list[0].items[0].body).toContain('"a":1');
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
