import { describe, expect, it } from 'vitest';
import { toBrunoText, toInsomnia, toPingto, toPostman } from '../../modules/exporters.js';
import { importAs, importPostman } from '../../modules/importers.js';

const sample = [{
  id: 'c1',
  name: 'Demo',
  items: [
    {
      type: 'folder',
      id: 'f1',
      name: 'Auth',
      items: [
        {
          type: 'request',
          id: 'r1',
          name: 'Health',
          method: 'GET',
          url: 'http://x/health',
          headers: [{ key: 'Accept', value: 'application/json' }],
          bodyType: 'none',
          body: '',
          authType: 'inherit',
        },
      ],
    },
  ],
  authType: 'bearer',
  auth: { token: 'abc' },
}];

describe('exporters', () => {
  it('writes pingto envelope', () => {
    const json = toPingto(sample);
    expect(json.format).toBe('pingto');
    expect(json.collections[0].name).toBe('Demo');
  });

  it('round-trips through Postman v2', () => {
    const pm = toPostman(sample);
    expect(pm.info.schema).toContain('collection/v2.1.0');
    const back = importPostman(pm);
    expect(back[0].name).toBe('Demo');
    expect(back[0].items[0].name).toBe('Auth');
    expect(back[0].items[0].items[0].url).toBe('http://x/health');
    expect(pm.auth.type).toBe('bearer');
    expect(back[0].authType).toBe('bearer');
    expect(back[0].items[0].items[0].authType).toBe('inherit');
  });

  it('round-trips through Insomnia export', () => {
    const ins = toInsomnia(sample);
    expect(ins.__export_format).toBe(4);
    const back = importAs('insomnia', ins);
    expect(back[0].name).toBe('PingTo');
    expect(back[0].items[0].name).toBe('Demo');
    expect(back[0].items[0].items[0].name).toBe('Auth');
    expect(back[0].items[0].items[0].items[0].url).toBe('http://x/health');
    expect(back[0].items[0].items[0].items[0].headers[0].key).toBe('Accept');
  });

  it('writes Bruno bundle that importAs understands', () => {
    const text = toBrunoText(sample);
    expect(text).toContain('===== Demo/Auth/Health.bru =====');
    const back = importAs('bruno', text);
    expect(back[0].name).toBe('Demo');
    expect(back[0].items[0].name).toBe('Auth');
    expect(back[0].items[0].items[0].url).toBe('http://x/health');
  });
});
