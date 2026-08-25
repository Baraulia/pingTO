import { describe, expect, it } from 'vitest';
import { CodeGenerator } from '../../modules/code-generator.js';
import { UIHelpers } from '../../modules/ui-helpers.js';

describe('code-generator', () => {
  it('lists languages and generates each of them', () => {
    const langs = CodeGenerator.getLanguages();
    expect(langs).toEqual(['javascript', 'typescript', 'python', 'php', 'go', 'curl', 'csharp', 'java']);
    for (const lang of langs) {
      const code = CodeGenerator.generate('POST', 'http://x/json', { Accept: 'application/json' }, '{"a":1}', lang);
      expect(code).not.toBe('Language not supported');
      expect(code).toContain('http://x/json');
    }
  });
});

describe('ui-helpers', () => {
  it('escapes html and formats time/size', () => {
    expect(UIHelpers.escapeHtml('<a & "b">')).toBe('&lt;a &amp; &quot;b&quot;&gt;');
    expect(UIHelpers.formatTime(250)).toBe('250ms');
    expect(UIHelpers.formatTime(2500)).toBe('2.50s');
    expect(UIHelpers.formatSize(0)).toMatch(/0/);
  });
});
