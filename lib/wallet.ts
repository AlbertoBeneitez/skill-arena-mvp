/**
 * v186 · Changing euros to cosmicoins (₡) and back. 1 € = 1 ₡ nominal; each change keeps a 5 % commission, the only
 * commission in the app (groups keep none). Amounts in whole cents, so rounding is exact and reproducible.
 */
export const EXCHANGE_FEE_BPS = 500;
export const EXCHANGE_FEE_PERCENT = EXCHANGE_FEE_BPS / 100;

/** What changing `amount` (in € or ₡, 2 decimals) leaves after the commission. */
export function exchange(amount: number) {
  const cents = Math.round(amount * 100);
  const feeCents = Math.round((cents * EXCHANGE_FEE_BPS) / 10000);
  return { amount: cents / 100, fee: feeCents / 100, net: (cents - feeCents) / 100 };
}
