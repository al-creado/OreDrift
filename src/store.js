/*
 * In-app purchases through Google Play Billing (@capgo/native-purchases).
 * Only exists in the Android app. In a browser nothing is available, except with `?mockstore` on the dev server.
 * Product IDs live in data.js (PRODUCTS) and must be created as one-time products in Play Console.
 */
import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases';
import { PRODUCTS } from './data.js';
import { isNative } from './native.js';

// `?mockstore` fakes Google Play so the shop can be tried on a desktop. Stripped from production builds.
const MOCK = import.meta.env.DEV && typeof location !== 'undefined' && location.search.includes('mockstore');
const MOCK_PRICES = { remove_ads: '$2.99', starter_bundle: '$1.99', boost_25: '$3.99', ore_small: '$0.99', ore_medium: '$2.99', ore_large: '$7.99' };

let prices = {};
let available = false;
let mockHeld = []; // what the pretend store says the player owns

export const storeAvailable = () => available;
export const priceOf = (id) => prices[id] || '';

export async function initStore() {
  if (MOCK) { prices = { ...MOCK_PRICES }; available = true; return; }
  if (!isNative()) return;
  try {
    const { isBillingSupported } = await NativePurchases.isBillingSupported();
    if (!isBillingSupported) return;
    const { products } = await NativePurchases.getProducts({
      productIdentifiers: PRODUCTS.map((p) => p.id),
      productType: PURCHASE_TYPE.INAPP,
    });
    prices = {};
    for (const p of products) prices[p.identifier] = p.priceString;
    available = Object.keys(prices).length > 0;
  } catch (e) {
    available = false;
  }
}

/**
 * Starts the Play purchase sheet for one product.
 * Resolves { status: 'purchased', productId, orderId, token } | { status: 'cancelled' } | { status: 'error' }.
 * Packs are NOT consumed here: the caller grants the ore, saves, then calls finishPack().
 */
export async function purchase(product) {
  if (MOCK) {
    const order = 'mock.' + Date.now();
    if (product.kind === 'once') mockHeld.push({ productId: product.id, orderId: order, token: 't' + order, acknowledged: true });
    else mockHeld.push({ productId: product.id, orderId: order, token: 't' + order, acknowledged: false });
    return new Promise((r) => setTimeout(() => r({ status: 'purchased', productId: product.id, orderId: order, token: 't' + order }), 600));
  }
  try {
    const t = await NativePurchases.purchaseProduct({
      productIdentifier: product.id,
      productType: PURCHASE_TYPE.INAPP,
      isConsumable: false,
      autoAcknowledgePurchases: product.kind !== 'pack',
    });
    return { status: 'purchased', productId: t.productIdentifier, orderId: t.orderId || t.transactionId, token: t.purchaseToken };
  } catch (e) {
    const msg = String((e && e.message) || e).toLowerCase();
    return { status: msg.includes('cancel') ? 'cancelled' : 'error' };
  }
}

/** Marks a granted pack as used so it can be bought again. */
export async function finishPack(token) {
  if (!token) return;
  if (MOCK) { mockHeld = mockHeld.filter((h) => h.token !== token); return; }
  try { await NativePurchases.consumePurchase({ purchaseToken: token }); } catch (e) { /* retried on next start */ }
}

/**
 * What Google Play says this player holds: owned one-time products, plus packs that were paid for but not yet consumed.
 * Also acknowledges one-time products that were never acknowledged (Play refunds those after 3 days).
 * Resolves [{ productId, orderId, token }]; [] when the store cannot be reached.
 */
export async function ownedPurchases() {
  if (MOCK) return mockHeld.map((h) => ({ ...h }));
  if (!available) return [];
  try {
    const { purchases } = await NativePurchases.getPurchases({ productType: PURCHASE_TYPE.INAPP });
    const out = [];
    for (const t of purchases) {
      if (t.purchaseState !== undefined && t.purchaseState !== '1') continue; // pending or cancelled
      const product = PRODUCTS.find((p) => p.id === t.productIdentifier);
      if (!product) continue;
      if (product.kind === 'once' && t.isAcknowledged === false && t.purchaseToken) {
        try { await NativePurchases.acknowledgePurchase({ purchaseToken: t.purchaseToken }); } catch (e) { /* retried next start */ }
      }
      out.push({ productId: t.productIdentifier, orderId: t.orderId || t.transactionId, token: t.purchaseToken });
    }
    return out;
  } catch (e) {
    return [];
  }
}
