import assert from "node:assert/strict";
import { applyCoreInput, replayCore, stepCore } from "../lib/verified/coreRuntime.v1";
import { SLOT_CORE_V4 as core, SLOT_RULES_V4 as R, SLOT_SYMBOLS_V4, slotPayoutV4 } from "../lib/verified/galacticSlotCore.v4";
import { verifyCoreFixture } from "./core-test-utils";
import { playSlotV4 } from "./slot-v4-play-fixture";
import fixture from "./fixtures/slot-v4.json" with { type: "json" };

assert.equal(core.gameVersion, "4.0.0");
// Seven symbols, no orange (id 1); every strip is a permutation of them.
for (let i = 0; i < 30; i++) {
  const s = core.create(`slot4-${i}`);
  assert.deepEqual(s, core.create(`slot4-${i}`));
  for (const strip of s.strips) assert.deepEqual([...strip].sort((a, b) => a - b), [...SLOT_SYMBOLS_V4]);
  assert.ok(s.strips.every((strip) => !strip.includes(1)), "no orange");
  assert.ok(s.positions.every((p) => p >= 0 && p < 7));
}
// Pay table: triples, per-symbol pairs, nothing else (a seven alone pays nothing).
const c = R.costMinor;
assert.equal(slotPayoutV4([7, 7, 7]), 40 * c);
assert.equal(slotPayoutV4([0, 0, 0]), 4 * c);
assert.equal(slotPayoutV4([7, 7, 3]), 8 * c);
assert.equal(slotPayoutV4([6, 2, 6]), 6 * c);
assert.equal(slotPayoutV4([3, 0, 0]), 1 * c);
assert.equal(slotPayoutV4([7, 2, 3]), 0, "no seven-without-pair refund");
assert.equal(slotPayoutV4([0, 2, 3]), 0);
const pairs = SLOT_SYMBOLS_V4.map((id) => R.pair[id]), triples = SLOT_SYMBOLS_V4.map((id) => R.triple[id]);
for (let i = 1; i < pairs.length; i++) { assert.ok(pairs[i] > pairs[i - 1], "pairs climb with the symbol"); assert.ok(triples[i] > triples[i - 1]); }
for (let i = 0; i < pairs.length; i++) assert.equal(triples[i], pairs[i] * (i === pairs.length - 1 ? 5 : 4), "a triple pays four pairs (the seven, five)");
// Steps −3…+3, each landing on a different stop; all-zero is unavailable.
{
  const s = core.create("slot4-steps");
  for (let i = 0; i < 10; i++) stepCore(core, s, 1e9);
  const tap = (a: string) => { const ok = applyCoreInput(core, s, a, 1e9); for (let i = 0; i < 5; i++) stepCore(core, s, 1e9); return ok; };
  while (s.steps[0] < 3) assert.equal(tap("REEL_0_MORE"), true);
  assert.equal(core.canApply(s, "REEL_0_MORE"), false, "+4 is not available");
  while (s.steps[1] > -3) assert.equal(tap("REEL_1_LESS"), true);
  assert.equal(core.canApply(s, "REEL_1_LESS"), false);
  const before = s.positions.slice();
  assert.equal(tap("SPIN"), true);
  while (s.settlingAt !== -1) stepCore(core, s, 1e9);
  assert.equal(s.positions[0], (before[0] + 3) % 7);
  assert.equal(s.positions[1], (before[1] - 3 + 7) % 7);
  const z = core.create("slot4-zero");
  for (let i = 0; i < 10; i++) stepCore(core, z, 1e9);
  for (const r of [0, 1, 2]) { applyCoreInput(core, z, `REEL_${r}_LESS`, 1e9); for (let i = 0; i < 5; i++) stepCore(core, z, 1e9); }
  assert.deepEqual(z.steps, [0, 0, 0]);
  assert.equal(core.canApply(z, "SPIN"), false, "000 is not a wager");
}
// Reading the visible strips beats blind spinning; replays are exact.
const greedy = playSlotV4("slot4-skill", "greedy", 30), plain = playSlotV4("slot4-skill", "plain", 30);
assert.ok(greedy.s.score > plain.s.score, `skill matters (${greedy.s.score} vs ${plain.s.score})`);
const replay = replayCore(core, greedy.inputs, greedy.s.tick, "slot4-skill", 1e9);
assert.equal(replay.valid, true, String(replay.error));
for (const r of fixture.runs as any[])
  verifyCoreFixture(core, r.seed, r.inputs.map(([tick, action]: (string | number)[], seq: number) => ({ seq, tick: Number(tick), action: String(action) })), r.finalTick, 1e9, { score: r.score, status: r.status, failure: r.failure, hash: r.hash });
assert.ok(fixture.runs.length >= 2, "golden runs present");
console.log(`Slot V4 OK · 7 symbols, pairs by symbol · greedy ${greedy.s.score / 100} vs plain ${plain.s.score / 100} chips`);
