import { describe, expect, it } from 'vitest';
import { collectionToBruFiles, requestToBru, sanitizeExport } from '../../modules/bruno-export.js';

describe('bruno-export', () => {
  it('renders a bru request', () => {
    const bru = requestToBru({
      name: 'Health',
      method: 'GET',
      url: 'http://x/health',
      headers: [{ key: 'Accept', value: 'application/json' }],
    });
    expect(bru).toContain('name: Health');
    expect(bru).toContain('method: GET');
    expect(bru).toContain('Accept: application/json');
  });

  it('walks folders into file paths and strips secrets', () => {
    const coll = {
      name: 'Col',
      items: [
        {
          type: 'folder',
          name: 'Auth',
          items: [
            {
              type: 'request',
              name: 'Bearer',
              method: 'GET',
              url: 'http://x',
              headers: [{ key: 'Authorization', value: 'secret' }],
              auth: { token: 'tok', clientSecret: 's' },
            },
          ],
        },
      ],
    };
    expect(collectionToBruFiles(coll)[0].path).toBe('Col/Auth/Bearer.bru');
    const clean = sanitizeExport(coll);
    expect(clean.items[0].items[0].headers[0].value).toBe('');
    expect(clean.items[0].items[0].auth.token).toBe('');
  });
});
