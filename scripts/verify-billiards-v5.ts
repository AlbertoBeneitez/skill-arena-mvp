import assert from "node:assert/strict";
import { applyCoreInput, replayCore, stepCore } from "../lib/verified/coreRuntime.v1";
import { BILLIARDS_POCKETS } from "../lib/verified/billiardsCore.v1";
import { BILLIARDS_CORE_V5 as core, BILLIARDS_V5_RULES as V, isSolid, isStripe, oppositePocket, type BilliardsV5State } from "../lib/verified/billiardsCore.v5";
import { billiardsAimAction } from "../lib/verified/billiardsProtocol.v1";
import { billiardsPowerActionV3 } from "../lib/verified/billiardsCore.v3";
import { verifyCoreFixture } from "./core-test-utils";
import { aimTowards, playBilliardsV5 } from "./billiards-v5-play-fixture";
import fixture from "./fixtures/billiards-v5.json" with { type: "json" };

assert.equal(core.gameVersion, "5.0.0");
// Rack: 15 balls + cue, 1 on the apex, the 8 in the middle, one solid and one stripe in the back corners, no overlap.
const racks = new Set<string>();
for (let i = 0; i < 40; i++) {
  const s = core.create(`rack-${i}`);
  assert.deepEqual(core.create(`rack-${i}`), s);
  assert.deepEqual(s.balls.map((b) => b.id), Array.from({ length: 16 }, (_, k) => k));
  const at = (id: number) => s.balls.find((b) => b.id === id)!;
  assert.equal(at(1).y, V.footSpot.y, "1 on the apex");
  const rows = [...new Set(s.balls.slice(1).map((b) => b.y))].sort((a, b) => b - a);
  assert.equal(rows.length, 5);
  assert.equal(at(8).y, rows[2]); assert.equal(at(8).x, V.footSpot.x, "8 in the middle of row 3");
  const back = s.balls.filter((b) => b.y === rows[4]).sort((a, b) => a.x - b.x);
  assert.ok(isSolid(back[0].id) !== isSolid(back[4].id) && !isSolid(back[0].id) === isStripe(back[0].id), "mixed back corners");
  for (const a of s.balls) for (const b of s.balls) if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 20000, "no overlap");
  racks.add(s.balls.map((b) => `${b.x},${b.y}`).join(";"));
}
assert.ok(racks.size >= 30, "the rack varies with the seed");

// Scenario helper: only the listed balls on the table, then one shot straight at a pocket.
function table(spec: Record<number, [number, number]>, patch: Partial<BilliardsV5State> = {}) {
  const s = core.create("scenario");
  s.totalShots = 3;
  for (const b of s.balls) {
    const p = spec[b.id];
    if (p) { b.x = p[0]; b.y = p[1]; b.potted = false; } else if (b.id !== 0) b.potted = true;
  }
  Object.assign(s, patch);
  return s;
}
function shoot(s: BilliardsV5State, target: { x: number; y: number }, power = 6) {
  for (const a of [billiardsAimAction(aimTowards(s.balls[0], target)), billiardsPowerActionV3(power), "SHOOT"]) applyCoreInput(core, s, a, 1e9);
  while (s.status === "running" && s.phase === "moving") stepCore(core, s, 1e9);
  return s;
}
const TL = BILLIARDS_POCKETS[0], BR = BILLIARDS_POCKETS[5];
// Ball 40 px from the top-left pocket, the cue 50 px behind it on the same diagonal.
const nearTL: [number, number] = [TL.x + 40000, TL.y + 40000], behindTL: [number, number] = [TL.x + 90000, TL.y + 90000];
const nearBR: [number, number] = [BR.x - 40000, BR.y - 40000], behindBR: [number, number] = [BR.x - 90000, BR.y - 90000];
// Open table: the first ball potted decides the group and scores.
{
  const s = shoot(table({ 0: behindTL, 11: nearTL, 3: [195000, 300000] }), TL);
  assert.equal(s.group, "stripes"); assert.equal(s.score, V.ownPoints);
  assert.ok(s.events.some((e) => e.kind === "group"));
}
// A ball of the other group costs 300; the cue ball in a pocket costs 250 and goes back to the head spot.
{
  const s = shoot(table({ 0: behindTL, 3: nearTL, 11: [195000, 300000] }, { group: "stripes", score: 2000 }), TL);
  assert.equal(s.score, 2000 - V.otherPenalty);
  const t = shoot(table({ 0: nearTL, 11: [195000, 300000] }, { group: "stripes", score: 2000 }), TL, 3);
  assert.equal(t.score, 2000 - V.scratchPenalty);
  assert.deepEqual([t.balls[0].x, t.balls[0].y, t.balls[0].potted], [V.headSpot.x, V.headSpot.y, false]);
}
// The seventh own ball sets the 8's pocket: the one opposite to where it dropped.
{
  const spec: Record<number, [number, number]> = { 0: behindTL, 9: nearTL, 8: [195000, 300000] };
  const s = shoot(table(spec, { group: "stripes", ownDown: 6, score: 6000 }), TL);
  assert.equal(s.ownDown, 7);
  assert.equal(s.eightPocket, oppositePocket(0)); assert.equal(s.eightPocket, 5, "top-left ↔ bottom-right");
  assert.equal(oppositePocket(2), 3, "middle ↔ middle");
}
// The 8 into the right pocket wins with the bonus; into another pocket, early, or with the cue ball it loses.
{
  const win = shoot(table({ 0: behindBR, 8: nearBR }, { group: "solids", ownDown: 7, eightPocket: 5, score: 7000 }), BR);
  assert.equal(win.status, "won"); assert.equal(win.score, 7000 + V.eightBonus + win.shotsLeft * V.shotLeftBonus);
  const wrong = shoot(table({ 0: behindTL, 8: nearTL }, { group: "solids", ownDown: 7, eightPocket: 5, score: 7000 }), TL);
  assert.equal(wrong.status, "failed"); assert.equal(wrong.failure, "EIGHT_WRONG_POCKET"); assert.equal(wrong.score, 7000, "no bonus");
  const early = shoot(table({ 0: behindTL, 8: nearTL, 2: [195000, 300000] }, { group: "solids", ownDown: 6, score: 6000 }), TL);
  assert.equal(early.failure, "EIGHT_EARLY");
}
// On the break the 8 is respotted instead of ending the game.
{
  const s = table({ 0: behindTL, 8: nearTL }, { totalShots: 0 });
  shoot(s, TL);
  const eight = s.balls.find((b) => b.id === 8)!;
  assert.equal(s.status, "running"); assert.equal(eight.potted, false);
  assert.ok(s.events.some((e) => e.kind === "respotEight"));
}
// Full games by the test player: replay-identical, scores consistent.
for (const seed of ["bv5-a", "bv5-b"]) {
  const run = playBilliardsV5(seed);
  assert.notEqual(run.s.status, "running");
  const replay = replayCore(core, run.inputs, run.s.tick, seed, 1e9);
  assert.equal(replay.valid, true, String(replay.error));
  assert.deepEqual(replay.state, run.s);
  assert.ok(run.s.ownDown > 0 || run.s.group === "open");
}
for (const r of fixture.runs as any[])
  verifyCoreFixture(core, r.seed, r.inputs.map(([tick, action]: (string | number)[], seq: number) => ({ seq, tick: Number(tick), action: String(action) })), r.finalTick, 1e9, { score: r.score, status: r.status, failure: r.failure, hash: r.hash });
console.log(`Billiards V5 OK · 15-ball rack (solids/stripes/black 8) · groups, fouls, 8 last into the pocket opposite the 7th · break respot · fixtures ${(fixture.runs as any[]).map((r) => `${r.status}/${r.score}`).join(" ")}`);
