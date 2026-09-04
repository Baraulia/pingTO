import { describe, expect, it } from 'vitest';
import { buildWorkspace, unwrapWorkspace, wrapWorkspace } from '../../modules/workspace-sync.js';

describe('workspace sync', () => {
  it('builds a plaintext envelope without license fields', () => {
    const ws = buildWorkspace({
      collections: [{ id: 1, name: 'C', items: [] }],
      environments: [{ id: 2, name: 'dev', variables: { host: 'x' } }],
      settings: { timeout: 1000 },
      language: 'ru',
      theme: 'light',
    });
    expect(ws.format).toBe('pingto-workspace');
    expect(ws.license).toBeUndefined();
    expect(ws.isPro).toBeUndefined();
    expect(ws.collections[0].name).toBe('C');
  });

  it('round-trips AES-GCM with a passphrase', async () => {
    const payload = buildWorkspace({ collections: [{ name: 'Secret', items: [] }] });
    const wrapped = await wrapWorkspace(payload, 'hunter2');
    expect(wrapped.format).toBe('pingto-workspace-enc');
    const open = await unwrapWorkspace(wrapped, 'hunter2');
    expect(open.collections[0].name).toBe('Secret');
    await expect(unwrapWorkspace(wrapped, 'wrong')).rejects.toThrow(/decrypt/i);
  });
});
