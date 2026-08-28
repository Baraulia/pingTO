import { describe, expect, it } from 'vitest';
import {
  compareVersions,
  DEFAULT_LOADTEST_MANIFEST_URL,
  detectLoadAgentPlatform,
  mergeLoadManifest,
  normalizeLoadManifest,
  verifyCommand,
} from '../../modules/loadtest-release.js';

describe('loadtest-release', () => {
  it('detects OS and arch from UA', () => {
    expect(detectLoadAgentPlatform({ ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', platform: 'Win32' })).toBe('windows-amd64');
    expect(detectLoadAgentPlatform({ ua: 'Macintosh', platform: 'MacIntel' })).toBe('macos-amd64');
    expect(detectLoadAgentPlatform({ platform: 'macOS', architecture: 'arm' })).toBe('macos-arm64');
    expect(detectLoadAgentPlatform({ ua: 'X11; Linux x86_64', platform: 'Linux x86_64' })).toBe('linux-amd64');
  });

  it('fills asset urls from releaseBase and compares versions', () => {
    const man = normalizeLoadManifest({
      version: '1.2.0',
      releaseBase: 'https://github.com/x/y/releases/download/v1.2.0',
      assets: { 'windows-amd64': { sha256: 'AbC', file: 'pingto-loadtest-windows-amd64.exe' } },
    });
    expect(man.assets['windows-amd64'].url).toContain('pingto-loadtest-windows-amd64.exe');
    expect(man.assets['windows-amd64'].sha256).toBe('abc');
    expect(compareVersions('1.0.0', '1.2.0')).toBe(-1);
    expect(compareVersions('1.2.0', '1.2.0')).toBe(0);
  });

  it('merges remote hashes over bundled empty assets', () => {
    const merged = mergeLoadManifest(
      { assets: { 'linux-amd64': { file: 'pingto-loadtest-linux-amd64' } } },
      { assets: { 'linux-amd64': { url: 'https://ex/a', sha256: 'aa'.repeat(32) } } },
    );
    expect(merged.assets['linux-amd64'].url).toBe('https://ex/a');
    expect(verifyCommand('windows-amd64', 'a.exe')).toContain('Get-FileHash');
    expect(DEFAULT_LOADTEST_MANIFEST_URL).toContain('Baraulia/pingTO');
  });
});
