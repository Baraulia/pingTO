import { beforeEach, describe, expect, it } from 'vitest';
import { buildAuthCodeUrl, parseOAuthRedirect } from '../../modules/oauth.js';

describe('oauth helpers', () => {
  beforeEach(() => {
    globalThis.chrome = {
      identity: { getRedirectURL: () => 'https://abcdefghijklmnopqrstuvwxyz.chromiumapp.org/' },
    };
  });

  it('builds an authorization URL with PKCE', () => {
    const url = buildAuthCodeUrl({
      authUrl: 'http://127.0.0.1:8787/oauth/authorize',
      clientId: 'pingto',
      scope: 'api',
      state: 'st',
      challenge: 'abc',
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get('client_id')).toBe('pingto');
    expect(parsed.searchParams.get('code_challenge')).toBe('abc');
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
    expect(parsed.searchParams.get('redirect_uri')).toContain('chromiumapp.org');
  });

  it('parses code and errors from the redirect', () => {
    expect(parseOAuthRedirect('https://ext.chromiumapp.org/?code=xyz&state=st')).toMatchObject({
      code: 'xyz',
      state: 'st',
    });
    expect(parseOAuthRedirect('https://ext.chromiumapp.org/#access_token=tok&token_type=Bearer')).toMatchObject({
      accessToken: 'tok',
    });
  });
});
