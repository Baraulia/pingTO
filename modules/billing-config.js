/**
 * PingTo Pro — $29 / year, 3 devices per license key.
 *
 * After you create the Lemon Squeezy store, paste only checkoutUrl.
 * Everything else (price, interval, device cap) is already set for the UI.
 *
 * Lemon Squeezy dashboard (do this once):
 * 1. Sign up: https://lemonsqueezy.com
 * 2. New product: "PingTo Pro"
 * 3. Pricing: subscription, $29 USD, billed yearly (not monthly)
 * 4. Enable license keys
 * 5. Activation limit: 3
 * 6. Copy the overlay / buy / checkout URL into checkoutUrl below
 * 7. Reload the unpacked extension
 *
 * Test mode keys work with Activate before you go live.
 */
export const BILLING_CONFIG = {
  provider: 'lemonsqueezy',
  checkoutUrl: '',
  priceUsd: 29,
  priceLabel: '$29',
  interval: 'year',
  activationLimit: 3,
};
