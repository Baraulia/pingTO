import { describe, expect, it, vi } from 'vitest';
import { BILLING_CONFIG } from '../../modules/billing-config.js';
import {
  activateLicenseKey,
  checkoutConfigured,
  classifyLemonLicenseError,
  licenseFromLemonResponse,
  openCheckout,
} from '../../modules/billing.js';

describe('billing', () => {
  it('locks Pro to $29/year and 3 devices', () => {
    expect(BILLING_CONFIG.provider).toBe('lemonsqueezy');
    expect(BILLING_CONFIG.priceUsd).toBe(29);
    expect(BILLING_CONFIG.priceLabel).toBe('$29');
    expect(BILLING_CONFIG.interval).toBe('year');
    expect(BILLING_CONFIG.activationLimit).toBe(3);
  });

  it('requires an https checkout url', () => {
    expect(checkoutConfigured({ checkoutUrl: '' })).toBe(false);
    expect(checkoutConfigured({ checkoutUrl: 'https://pingto.lemonsqueezy.com/buy/x' })).toBe(true);
  });

  it('maps a Lemon Squeezy validate payload', () => {
    const license = licenseFromLemonResponse({
      valid: true,
      license_key: { status: 'active', expires_at: '2027-01-15T00:00:00Z' },
      instance: { id: 'inst-1' },
    }, ' KEY ');
    expect(license.key).toBe('KEY');
    expect(license.status).toBe('active');
    expect(license.instanceId).toBe('inst-1');
    expect(license.expiresAt).toBe(Date.parse('2027-01-15T00:00:00Z'));
  });

  it('rejects invalid Lemon payloads', () => {
    expect(() => licenseFromLemonResponse({ valid: false, error: 'expired' }, 'k')).toThrow(/expired/);
  });

  it('activates via the Lemon license API', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ valid: true, license_key: { status: 'active' }, instance: { id: 'i' } }),
    }));
    const license = await activateLicenseKey('abc', { fetchImpl, instanceName: 'pingto-test' });
    expect(license.status).toBe('active');
    expect(fetchImpl).toHaveBeenCalled();
    const [, init] = fetchImpl.mock.calls[0];
    expect(init.body).toContain('license_key=abc');
    expect(init.body).toContain('instance_name=pingto-test');
  });

  it('throws when checkout is missing', () => {
    expect(() => openCheckout({ checkoutUrl: '' })).toThrow(/checkout_not_configured/);
  });

  it('maps activation-limit errors', () => {
    expect(classifyLemonLicenseError('This license key has reached the activation limit.')).toBe('activation_limit');
  });

  it('validates when this device is already activated', async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (String(url).endsWith('/activate')) {
        return {
          ok: false,
          json: async () => ({ valid: false, error: 'This license key has already been activated.' }),
        };
      }
      return {
        ok: true,
        json: async () => ({ valid: true, license_key: { status: 'active' }, instance: { id: 'i' } }),
      };
    });
    const license = await activateLicenseKey('abc', { fetchImpl, instanceName: 'pingto-test' });
    expect(license.status).toBe('active');
    expect(fetchImpl.mock.calls[0][0]).toMatch(/\/activate$/);
    expect(fetchImpl.mock.calls[1][0]).toMatch(/\/validate$/);
  });
});
