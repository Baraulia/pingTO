function b64url(bytes) {
  let bin = '';
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function createPkce() {
  const verifierBytes = crypto.getRandomValues(new Uint8Array(32));
  const verifier = b64url(verifierBytes);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = b64url(new Uint8Array(digest));
  return { verifier, challenge };
}

export function redirectUri() {
  return chrome.identity.getRedirectURL();
}

export function buildAuthCodeUrl({ authUrl, clientId, scope, state, challenge }) {
  const url = new URL(authUrl);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri());
  if (scope) url.searchParams.set('scope', scope);
  url.searchParams.set('state', state || 'pingto');
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

export function parseOAuthRedirect(redirectUrl) {
  const url = new URL(redirectUrl);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
  const query = url.searchParams;
  return {
    code: query.get('code') || hash.get('code'),
    error: query.get('error') || hash.get('error'),
    accessToken: hash.get('access_token'),
    tokenType: hash.get('token_type'),
    state: query.get('state') || hash.get('state'),
  };
}

export async function launchAuthCode({ authUrl, clientId, scope }) {
  const pkce = await createPkce();
  const url = buildAuthCodeUrl({
    authUrl,
    clientId,
    scope,
    challenge: pkce.challenge,
  });
  const response = await chrome.runtime.sendMessage({ type: 'launchOAuth', url });
  if (response.error) throw new Error(response.error);
  if (!response.redirectUrl) throw new Error('OAuth redirect was empty');
  const parsed = parseOAuthRedirect(response.redirectUrl);
  if (parsed.error) throw new Error(parsed.error);
  return { ...parsed, verifier: pkce.verifier, redirectUri: redirectUri() };
}

export async function exchangeCode({ tokenUrl, clientId, clientSecret, code, verifier }) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    redirect_uri: redirectUri(),
    code_verifier: verifier,
  });
  if (clientSecret) body.set('client_secret', clientSecret);
  const res = await chrome.runtime.sendMessage({
    type: 'sendRequest',
    data: {
      method: 'POST',
      url: tokenUrl,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    },
  });
  const json = JSON.parse(res.body || '{}');
  if (!json.access_token) throw new Error(json.error_description || 'No access_token');
  return json;
}

export async function refreshToken({ tokenUrl, clientId, clientSecret, refresh }) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refresh,
    client_id: clientId,
  });
  if (clientSecret) body.set('client_secret', clientSecret);
  const res = await chrome.runtime.sendMessage({
    type: 'sendRequest',
    data: {
      method: 'POST',
      url: tokenUrl,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    },
  });
  return JSON.parse(res.body || '{}');
}
