/** v186 · Studio payout split: 50 % of the net commission by counted matches, whole cents, exact totals. */
import assert from "node:assert/strict";
import { STUDIO_SHARE_BPS, splitCommission } from "../lib/studioPayout";

const HOUSE = "GALACTIC GAMES";
const creator = (id: string) => (id.startsWith("nova-") ? "Nova Studio" : id.startsWith("orbit-") ? "Orbit Lab" : HOUSE);
assert.equal(STUDIO_SHARE_BPS, 5000);

// 100,00 € of net commission; 1 000 matches: 600 house, 300 Nova, 100 Orbit → pool 50 €: 30 / 15 / 5.
{
  const r = splitCommission(10000, [{ gameId: "slot", plays: 600 }, { gameId: "nova-run", plays: 300 }, { gameId: "orbit-1", plays: 100 }], creator, HOUSE);
  assert.equal(r.pool, 5000);
  assert.deepEqual(r.lines.map((l) => [l.creator, l.cents]), [[HOUSE, 3000], ["Nova Studio", 1500], ["Orbit Lab", 500]]);
  assert.equal(r.house, 10000 - 1500 - 500, "the house keeps its half plus its own games' share");
}
// Several games of one studio add up; rounding never loses or invents a cent.
for (let total = 0; total <= 2000; total += 37) {
  const r = splitCommission(total, [{ gameId: "slot", plays: 7 }, { gameId: "nova-a", plays: 3 }, { gameId: "nova-b", plays: 5 }, { gameId: "orbit-x", plays: 11 }], creator, HOUSE);
  assert.equal(r.lines.reduce((a, l) => a + l.cents, 0), r.pool);
  assert.equal(r.house + r.lines.filter((l) => l.creator !== HOUSE).reduce((a, l) => a + l.cents, 0), total);
  assert.equal(r.lines.find((l) => l.creator === "Nova Studio")?.plays, 8);
}
// No matches: nothing is paid to studios.
assert.equal(splitCommission(5000, [], creator, HOUSE).house, 5000);
assert.throws(() => splitCommission(10.5, [], creator, HOUSE));
assert.throws(() => splitCommission(100, [{ gameId: "x", plays: -1 }], creator, HOUSE));
console.log("Studio payout: 50 % of the net commission by counted matches, exact cents");
