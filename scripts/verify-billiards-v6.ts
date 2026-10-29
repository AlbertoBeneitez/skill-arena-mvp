import assert from "node:assert/strict";
import { applyCoreInput, replayCore, stepCore } from "../lib/verified/coreRuntime.v1";
import { BILLIARDS_POCKETS, BILLIARDS_RULES as R } from "../lib/verified/billiardsCore.v1";
import { BILLIARDS_CORE_V6 as core, BILLIARDS_V6_RULES as V, billiardsLevelLayoutV6, isBlocker, isTarget, type BilliardsV6State } from "../lib/verified/billiardsCore.v6";
import { billiardsAimAction } from "../lib/verified/billiardsProtocol.v1";
import { billiardsPowerActionV3 } from "../lib/verified/billiardsCore.v3";
import { verifyCoreFixture } from "./core-test-utils";
import { aimTowardsV6, playBilliardsV6 } from "./billiards-v6-play-fixture";
import fixture from "./fixtures/billiards-v6.json" with { type: "json" };

assert.equal(core.gameVersion, "6.0.0");
assert.deepEqual(V.levelShots, [4, 5, 5, 6, 7]);
// Layouts: legal (on the cloth, clear of pockets and of each other), seeded, and different every match.
const expect = [{ t: 2, b: 0, e: 0 }, { t: 3, b: 0, e: 0 }, { t: 3, b: 0, e: 0 }, { t: 3, b: 3, e: 0 }, { t: 4, b: 2, e: 1 }];
for (let level = 1; level <= 5; level++) {
  const seen = new Set<string>();
  for (let i = 0; i < 60; i++) {
    const L = billiardsLevelLayoutV6(`layout-${i}`, level);
    assert.deepEqual(billiardsLevelLayoutV6(`layout-${i}`, level), L, "pure function of seed and level");
    const ids = L.balls.map((b) => b.id);
    assert.equal(ids.filter(isTarget).length, expect[level - 1].t, `targets L${level}`);
    assert.equal(ids.filter(isBlocker).length, expect[level - 1].b, `blockers L${level}`);
    assert.equal(ids.filter((id) => id === 8).length, expect[level - 1].e, `eight L${level}`);
    const all = [L.cue, ...L.balls];
    for (const p of all) {
      assert.ok(p.x >= R.left + R.radius && p.x <= R.right - R.radius && p.y >= R.top + R.radius && p.y <= R.bottom - R.radius, `on the cloth L${level}`);
      for (const q of BILLIARDS_POCKETS) assert.ok(Math.hypot(p.x - q.x, p.y - q.y) > R.pocketRadius + R.radius, `not in a pocket L${level}`);
    }
    for (const a of all) for (const b of all) if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 2 * R.radius, `no overlap L${level}`);
    seen.add(all.map((p) => `${p.x},${p.y}`).join(";"));
  }
  assert.ok(seen.size >= 50, `level ${level} varies with the seed (${seen.size}/60)`);
}
// Level 2 balls are pinned to three different cushions; level 3 has two balls lined up on a pocket.
{
  const L = billiardsLevelLayoutV6("rails", 2);
  const rail = (p: { x: number; y: number }) => p.x <= R.left + R.radius + 2000 ? "L" : p.x >= R.right - R.radius - 2000 ? "R" : p.y <= R.top + R.radius + 2000 ? "T" : p.y >= R.bottom - R.radius - 2000 ? "B" : "-";
  assert.equal(new Set(L.balls.map(rail)).size, 3); assert.ok(!L.balls.some((b) => rail(b) === "-"));
  const C = billiardsLevelLayoutV6("combo", 3), [a, b] = [C.balls.find((x) => x.id === 1)!, C.balls.find((x) => x.id === 2)!];
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) <= 2 * R.radius + 2000, "combination pair touching");
}
const s0 = core.create("start");
assert.equal(s0.level, 1); assert.equal(s0.levelShotsLeft, 4); assert.equal(s0.balls[0].id, 0);
assert.ok(s0.events.some((e) => e.kind === "level" && e.level === 1));

function shoot(s: BilliardsV6State, target: { x: number; y: number }, power = 6) {
  for (const a of [billiardsAimAction(aimTowardsV6(s.balls[0], target)), billiardsPowerActionV3(power), "SHOOT"]) applyCoreInput(core, s, a, 1e9);
  while (s.status === "running" && s.phase === "moving") stepCore(core, s, 1e9);
  return s;
}
const TL = BILLIARDS_POCKETS[0];
const near = { x: TL.x + 40000, y: TL.y + 40000 }, behind = { x: TL.x + 90000, y: TL.y + 90000 };
function only(s: BilliardsV6State, spec: Record<number, { x: number; y: number }>) {
  for (const b of s.balls) { const p = spec[b.id]; if (p) { b.x = p.x; b.y = p.y; b.potted = false; } else if (b.id !== 0) b.potted = true; }
  s.balls[0].x = spec[0].x; s.balls[0].y = spec[0].y;
  return s;
}
// A target scores 1000; the last target clears the level: +500 +150 per shot left, then level 2 is laid out.
{
  const s = only(core.create("clear"), { 0: behind, 1: near });
  shoot(s, TL);
  assert.equal(s.level, 2, "next level");
  assert.equal(s.score, V.targetPoints + V.clearBonus + 3 * V.shotLeftBonus);
  assert.ok(s.events.some((e) => e.kind === "levelClear" && e.level === 1));
  assert.equal(s.levelShotsLeft, 5);
}
// A blocker costs 400; a scratch costs 250 and the cue comes back on the table.
{
  const s = core.create("blocker");
  while (s.level < 4) { s.levelShotsLeft = 1; shoot(s, { x: 195000, y: 96000 }, 0); }
  const blocker = s.balls.find((b) => isBlocker(b.id))!;
  only(s, { 0: behind, [blocker.id]: near, 1: { x: 195000, y: 300000 } });
  s.score = 3000;
  shoot(s, TL);
  assert.equal(s.score, 3000 - V.blockerPenalty);
  const t = only(core.create("scratch"), { 0: near, 1: { x: 195000, y: 300000 }, 2: { x: 250000, y: 200000 } });
  t.score = 2000;
  shoot(t, TL, 3);
  assert.equal(t.score, 2000 - V.scratchPenalty);
  assert.equal(t.balls[0].potted, false);
}
// Shots run out: the level ends without bonus and the next starts; after level 5 the match is over.
{
  const s = core.create("timeout");
  for (let i = 0; i < 4; i++) shoot(s, { x: 195000, y: 96000 }, 0);
  assert.equal(s.level, 2); assert.ok(s.events.some((e) => e.kind === "levelOver" && e.level === 1));
  while (s.status === "running") { s.levelShotsLeft = 1; shoot(s, { x: 195000, y: 96000 }, 0); }
  assert.equal(s.status, "won"); assert.equal(s.level, 5);
}
// Level 5: the 8 early costs 500 and comes back; the 8 last is +2000 and ends the gymkhana.
{
  const s = core.create("eight");
  while (s.level < 5) { s.levelShotsLeft = 1; shoot(s, { x: 195000, y: 96000 }, 0); }
  only(s, { 0: behind, 8: near, 1: { x: 195000, y: 300000 } });
  s.score = 5000;
  shoot(s, TL);
  assert.equal(s.score, 5000 - V.eightEarlyPenalty); assert.equal(s.balls.find((b) => b.id === 8)!.potted, false);
  const w = core.create("eight-win");
  while (w.level < 5) { w.levelShotsLeft = 1; shoot(w, { x: 195000, y: 96000 }, 0); }
  only(w, { 0: behind, 8: near });
  w.score = 5000; const left = w.levelShotsLeft - 1;
  shoot(w, TL);
  assert.equal(w.status, "won"); assert.equal(w.score, 5000 + V.eightBonus + V.clearBonus + left * V.shotLeftBonus);
}
// Full matches by the test player: replay-identical.
for (const seed of ["bv6-a", "bv6-b"]) {
  const run = playBilliardsV6(seed);
  assert.equal(run.s.status, "won");
  const replay = replayCore(core, run.inputs, run.s.tick, seed, 1e9);
  assert.equal(replay.valid, true, String(replay.error));
  assert.deepEqual(replay.state, run.s);
  assert.ok(run.s.levelsCleared >= 1, `the player clears at least one level (${run.s.levelsCleared})`);
}
for (const r of fixture.runs as any[])
  verifyCoreFixture(core, r.seed, r.inputs.map(([tick, action]: (string | number)[], seq: number) => ({ seq, tick: Number(tick), action: String(action) })), r.finalTick, 1e9, { score: r.score, status: r.status, failure: r.failure, hash: r.hash });
console.log(`Billiards V6 OK · gymkhana of 5 seeded levels · scoring, clears, run-outs, blockers, the 8 last · fixtures ${(fixture.runs as any[]).map((r) => `${r.status}/${r.score}`).join(" ")}`);
