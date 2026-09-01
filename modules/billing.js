import { BILLING_CONFIG } from './billing-config.js';
import { hasActiveLicense } from './entitlements.js';

export const LEMON_LICENSE_API = 'https://api.lemonsqueezy.com/v1/licenses';

export function checkoutConfigured(config = BILLING_CONFIG) {
  return /^https:\/\//i.test(String(config.checkoutUrl || '').trim());
}

export function openCheckout(config = BILLING_CONFIG) {
  const url = String(config.checkoutUrl || '').trim();
  if (!/^https:\/\//i.test(url)) {
    const err = new Error('checkout_not_configured');
    err.code = 'checkout_not_configured';
    throw err;
  }
  if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
    chrome.tabs.create({ url });
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function classifyLemonLicenseError(message) {
  const text = String(message || '').toLowerCase();
  if (/activation limit|maximum number of activations|too many activations/.test(text)) {
    return 'activation_limit';
  }
  if (/already been activated|already activated/.test(text)) return 'already_activated';
  if (/expired/.test(text)) return 'expired';
  if (/disabled|disabled_license/.test(text)) return 'disabled';
  return 'invalid_license';
}

export function licenseFromLemonResponse(json, key) {
  if (!json || json.valid !== true) {
    const err = new Error(json?.error || 'invalid_license');
    err.code = classifyLemonLicenseError(json?.error);
    throw err;
  }
  const lk = json.license_key || {};
  const raw = String(lk.status || '');
  const status = raw === 'expired' || raw === 'disabled' ? raw : 'active';
  const expiresAt = lk.expires_at ? Date.parse(lk.expires_at) : 0;
  return {
    key: String(key).trim(),
    status,
    expiresAt: Number.isFinite(expiresAt) ? expiresAt : 0,
    instanceId: json.instance?.id || '',
    provider: 'lemonsqueezy',
  };
}

export function licenseFromGenericResponse(json, key) {
  if (!json || json.valid !== true) {
    const err = new Error(json?.error || 'invalid_license');
    err.code = 'invalid_license';
    throw err;
  }
  const expiresAt = json.expiresAt || (json.expires_at ? Date.parse(json.expires_at) : 0);
  return {
    key: String(key).trim(),
    status: json.status === 'inactive' ? 'inactive' : 'active',
    expiresAt: Number(expiresAt) || 0,
    instanceId: json.instanceId || '',
    provider: 'generic',
  };
}

async function lemonForm(path, fields, fetchImpl) {
  const res = await fetchImpl(`${LEMON_LICENSE_API}/${path}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(fields).toString(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok && json.valid !== true) {
    const err = new Error(json.error || `HTTP ${res.status}`);
    err.code = classifyLemonLicenseError(json.error) === 'invalid_license' && !json.error
      ? 'license_http'
      : classifyLemonLicenseError(json.error);
    throw err;
  }
  return json;
}

export function instanceNameForDevice() {
  const id = typeof chrome !== 'undefined' ? chrome.runtime?.id : '';
  return `pingto-${String(id || 'dev').slice(0, 28)}`;
}

export async function activateLicenseKey(rawKey, opts = {}) {
  const key = String(rawKey || '').trim();
  if (!key) {
    const err = new Error('empty_key');
    err.code = 'empty_key';
    throw err;
  }
  const fetchImpl = opts.fetchImpl || globalThis.fetch.bind(globalThis);
  const config = opts.config || BILLING_CONFIG;
  const instanceName = opts.instanceName || instanceNameForDevice();

  if (config.provider === 'generic' && config.validateUrl) {
    const res = await fetchImpl(config.validateUrl, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, instanceName }),
    });
    const json = await res.json().catch(() => ({}));
    return licenseFromGenericResponse(json, key);
  }

  try {
    const json = await lemonForm('activate', { license_key: key, instance_name: instanceName }, fetchImpl);
    return licenseFromLemonResponse(json, key);
  } catch (err) {
    if (err?.code !== 'already_activated') throw err;
    const json = await lemonForm('validate', { license_key: key, instance_name: instanceName }, fetchImpl);
    return licenseFromLemonResponse(json, key);
  }
}

export async function deactivateLicense(license, opts = {}) {
  const key = String(license?.key || '').trim();
  if (!key) return;
  const fetchImpl = opts.fetchImpl || globalThis.fetch.bind(globalThis);
  const config = opts.config || BILLING_CONFIG;
  if (config.provider === 'generic') return;
  const fields = { license_key: key };
  if (license.instanceId) fields.instance_id = String(license.instanceId);
  try {
    await lemonForm('deactivate', fields, fetchImpl);
  } catch {
    /* local unlock still proceeds */
  }
}

export function billingStatusText(license, t = (k) => k) {
  if (!hasActiveLicense(license)) return t('billingStatusFree');
  if (license.expiresAt) {
    const day = new Date(license.expiresAt).toISOString().slice(0, 10);
    return t('billingStatusProUntil').replace('{date}', day);
  }
  return t('billingStatusPro');
}
