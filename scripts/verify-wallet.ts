/** v186 · Exchange commission: 5 % each way, whole cents, no drift. */
import assert from "node:assert/strict";
import { EXCHANGE_FEE_PERCENT, exchange } from "../lib/wallet";

assert.equal(EXCHANGE_FEE_PERCENT, 5);
assert.deepEqual(exchange(10), { amount: 10, fee: 0.5, net: 9.5 });
assert.deepEqual(exchange(0.01), { amount: 0.01, fee: 0, net: 0.01 });
assert.deepEqual(exchange(0.1), { amount: 0.1, fee: 0.01, net: 0.09 });
assert.deepEqual(exchange(19.99), { amount: 19.99, fee: 1, net: 18.99 });
for (let cents = 1; cents <= 100000; cents += 7) {
  const { amount, fee, net } = exchange(cents / 100);
  assert.equal(Math.round(fee * 100) + Math.round(net * 100), cents, "fee + net is exactly the amount");
  assert.ok(net <= amount && fee >= 0);
}
console.log("Wallet exchange: 5 % commission each way, exact cents");
