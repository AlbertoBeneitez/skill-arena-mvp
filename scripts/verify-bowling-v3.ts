import assert from "node:assert/strict";
import { applyCoreInput, replayCore, stepCore } from "../lib/verified/coreRuntime.v1";
import { BOWLING_CORE_V3 as core, BOWLING_RULES_V3 as R, bowlingScore } from "../lib/verified/bowlingCore.v3";
import { BOWLING_CORE_V2 as v2, BOWLING_RULES_V2 as R2 } from "../lib/verified/bowlingCore.v2";
import { BOWLING_ACTIONS_V2, bowlingActionV2 } from "../lib/verified/bowlingProtocol.v2";
import { bowlingAction } from "../lib/verified/bowlingProtocol.v1";
import { verifyCoreFixture } from "./core-test-utils";
import { playBowlingV3, varied } from "./bowling-v3-play-fixture";
import fixture from "./fixtures/bowling-v3.json" with { type: "json" };

type Act = typeof bowlingActionV2;
const throwAt = (c: typeof core | typeof v2, act: Act, rules: typeof R | typeof R2, angle: number, spin: number, power = 4) => {
  const s = c.create("bw3-x") as ReturnType<typeof core.create>;
  for (const a of [act("ANGLE", angle), act("SPIN", spin), act("POWER", power), "ROLL"]) assert.ok(applyCoreInput(c as typeof core, s, a, 1e9), a);
  let t = 0;
  while (s.phase === "rolling" && s.ball.y < rules.headPinY - 600_000) { stepCore(c as typeof core, s, 1e9); t++; }
  return { x: s.ball.x - rules.laneWidth / 2, t };
};
// V3: longer lane (32.0 m) — the ball takes ~1.17× longer to reach the pins than in V2.
{
  const a = throwAt(v2, bowlingAction as Act, R2, 12, 4), b = throwAt(core, bowlingActionV2, R, 24, 8);
  assert.equal(R.headPinY, 32004_000);
  assert.ok(b.t > a.t * 1.1 && b.t < a.t * 1.3, `ball reaches the pins later (${a.t} → ${b.t} ticks)`);
}
// More sensitive throw: one angle or spin step moves the ball less than a V2 step, the full range reaches further.
{
  const a1 = throwAt(v2, bowlingAction as Act, R2, 13, 4).x, b1 = throwAt(core, bowlingActionV2, R, 25, 8).x;
  assert.ok(b1 > 0 && b1 < a1 * 0.75, `angle step finer (${a1} → ${b1} µm)`);
  const s2 = throwAt(v2, bowlingAction as Act, R2, 12, 5).x, s3 = throwAt(core, bowlingActionV2, R, 24, 9).x;
  assert.ok(s3 > 0 && s3 < s2 * 0.8, `spin step finer (${s2} → ${s3} µm)`);
  const f2 = throwAt(v2, bowlingAction as Act, R2, 12, 8).x, f3 = throwAt(core, bowlingActionV2, R, 24, 16).x;
  assert.ok(f3 > f2 * 1.15, `full hook reaches further (${f2} → ${f3} µm)`);
  const l = throwAt(core, bowlingActionV2, R, 24, 0).x;
  assert.ok(l < 0, "negative spin hooks left");
}
assert.equal(BOWLING_ACTIONS_V2.length, 21 + 49 + 17 + 9 + 2);
assert.equal(bowlingScore(Array(12).fill(10)).total, 300, "perfect game");
assert.equal(bowlingScore([...Array(18).fill(0), 7, 3, 5]).total, 15);

const single = (aim: number, angle: number, spin: number, power: number) => {
  const s = core.create("bw3-one");
  for (const a of [bowlingActionV2("AIM", aim), bowlingActionV2("ANGLE", angle), bowlingActionV2("SPIN", spin), bowlingActionV2("POWER", power), "ROLL"]) { assert.ok(applyCoreInput(core, s, a, 1e9), a); stepCore(core, s, 1e9); }
  while (s.phase === "rolling") stepCore(core, s, 1e9);
  return s;
};
assert.equal(single(0, 0, 8, 4).rolls[0], 0, "gutter");
assert.equal(single(20, 48, 8, 4).rolls[0], 0, "gutter");
assert.ok(single(10, 24, 8, 4).rolls[0] >= 7, "centre hit");
// V1 action names are not V3 inputs.
{
  const s = core.create("bw3-names");
  assert.equal(core.canApply(s, "SPIN_4"), false);
  assert.equal(core.canApply(s, "SPIN_04"), true);
  assert.equal(core.canApply(s, "ANGLE_49"), false);
  applyCoreInput(core, s, "ROLL", 1e9);
  assert.equal(core.canApply(s, "AIM_03"), false, "locked while rolling");
}
// A strike celebration lasts 11.75 s unless skipped.
{
  let strike: ReturnType<typeof single> | null = null;
  for (let angle = 18; angle <= 30 && !strike; angle++) for (const spin of [6, 8, 10, 12]) { const s = single(10, angle, spin, 4); if (s.lastResult?.kind === "strike") { strike = s; break; } }
  assert.ok(strike, "a strike is possible");
  const start = strike!.phaseTick;
  assert.equal(strike!.phase, "celebrate");
  while (strike!.phase === "celebrate") stepCore(core, strike!, 1e9);
  assert.equal(strike!.tick - start, R.strikeTicks);
  assert.equal(R.strikeTicks, 1410);
  assert.equal(R.spareTicks, 1410);
}
const games = [0, 1, 2, 3, 4, 5].map((i) => playBowlingV3(`bw3-game-${i}`, varied(`bw3-game-${i}`, 2 + i), i % 2 === 0));
for (const g of games) {
  assert.equal(g.s.status, "won");
  assert.equal(g.s.frames.length, 10);
  assert.equal(g.s.score, bowlingScore(g.s.rolls).total);
  const replay = replayCore(core, g.inputs, g.s.tick, g.s.seed, 1e9);
  assert.equal(replay.valid, true, String(replay.error));
  assert.deepEqual(replay.state, g.s);
}
assert.ok(games.some((g) => g.s.strikes > 0), "strikes happen");
const watched = playBowlingV3("bw3-game-1", varied("bw3-game-1", 3), true);
assert.equal(watched.s.score, games[1].s.score, "skipping never changes the score");
for (const r of fixture.runs as any[])
  verifyCoreFixture(core, r.seed, r.inputs.map(([tick, action]: (string | number)[], seq: number) => ({ seq, tick: Number(tick), action: String(action) })), r.finalTick, 1e9, { score: r.score, status: r.status, failure: r.failure, hash: r.hash });
console.log(`Bowling V3 OK · 32 m lane · 49×17 throw steps · scores ${games.map((g) => g.s.score).join("/")}`);
