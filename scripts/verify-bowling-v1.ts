import assert from "node:assert/strict";
import { applyCoreInput, replayCore, stepCore } from "../lib/verified/coreRuntime.v1";
import { BOWLING_CORE_V1 as core, BOWLING_RULES_V1 as R, bowlingScore } from "../lib/verified/bowlingCore.v1";
import { BOWLING_ACTIONS_V1, bowlingAction } from "../lib/verified/bowlingProtocol.v1";
import { verifyCoreFixture } from "./core-test-utils";
import { playBowlingV1, varied } from "./bowling-v1-play-fixture";
import fixture from "./fixtures/bowling-v1.json" with { type: "json" };

// Scoring follows the ten-pin rules.
assert.equal(bowlingScore(Array(12).fill(10)).total, 300, "perfect game");
assert.equal(bowlingScore(Array(21).fill(5)).total, 150, "all spares with 5");
assert.equal(bowlingScore(Array(20).fill(0)).total, 0);
assert.equal(bowlingScore([10, 3, 6, ...Array(16).fill(0)]).total, 28);
assert.equal(bowlingScore([7, 3, 4, 2, ...Array(16).fill(0)]).total, 20);
assert.equal(bowlingScore([...Array(18).fill(0), 10, 10, 10]).total, 30, "tenth frame bonus balls");
assert.equal(bowlingScore([...Array(18).fill(0), 7, 3, 5]).total, 15);
assert.equal(BOWLING_ACTIONS_V1.length, 21 + 25 + 9 + 9 + 2);

const single = (aim: number, angle: number, spin: number, power: number) => {
  const s = core.create("bw-one");
  for (const a of [bowlingAction("AIM", aim), bowlingAction("ANGLE", angle), bowlingAction("SPIN", spin), bowlingAction("POWER", power), "ROLL"]) { assert.ok(applyCoreInput(core, s, a, 1e9), a); stepCore(core, s, 1e9); }
  while (s.phase === "rolling") stepCore(core, s, 1e9);
  return s;
};
// Gutter balls touch no pin; a ball into the pocket with hook carries; inputs are locked while rolling.
assert.equal(single(0, 0, 4, 4).rolls[0], 0, "gutter");
assert.equal(single(20, 24, 4, 4).rolls[0], 0, "gutter");
assert.ok(single(10, 12, 4, 4).rolls[0] >= 7, "centre hit");
{
  const s = core.create("bw-lock");
  applyCoreInput(core, s, "ROLL", 1e9);
  assert.equal(s.phase, "rolling");
  assert.equal(core.canApply(s, "AIM_03"), false);
  assert.equal(core.canApply(s, "SKIP"), false);
}
// Hook bends the ball on the dry back end only.
{
  const a = core.create("bw-hook"), b = core.create("bw-hook");
  for (const [s, spin] of [[a, 4], [b, 8]] as const) {
    applyCoreInput(core, s, bowlingAction("SPIN", spin), 1e9); applyCoreInput(core, s, "ROLL", 1e9);
    while (s.ball.y < R.oilEndY - 500_000) stepCore(core, s, 1e9);
  }
  assert.equal(a.ball.x, b.ball.x, "no hook on the oil");
  while (b.ball.y < R.headPinY - 1_000_000) { stepCore(core, a, 1e9); stepCore(core, b, 1e9); }
  assert.ok(b.ball.x > a.ball.x + 100_000, "hooks on the dry back end");
}
// Full games: ten frames, a strike celebration can be skipped, replay equivalence, accurate scores.
const games = [0, 1, 2, 3, 4, 5].map((i) => playBowlingV1(`bw-game-${i}`, varied(`bw-game-${i}`, 2 + i), i % 2 === 0));
for (const g of games) {
  assert.equal(g.s.status, "won");
  assert.equal(g.s.phase, "done");
  assert.equal(g.s.frames.length, 10);
  assert.equal(g.s.score, bowlingScore(g.s.rolls).total);
  for (const f of g.s.frames.slice(0, 9)) assert.ok(f.length === 1 ? f[0] === 10 : f.length === 2 && f[0] + f[1] <= 10);
  const replay = replayCore(core, g.inputs, g.s.tick, g.s.seed, 1e9);
  assert.equal(replay.valid, true, String(replay.error));
  assert.deepEqual(replay.state, g.s);
}
assert.ok(games.some((g) => g.s.strikes > 0), "strikes happen");
const skipped = games[0], watched = playBowlingV1("bw-game-0", varied("bw-game-0", 2), false);
assert.equal(watched.s.score, skipped.s.score, "skipping never changes the score");
if (skipped.s.strikes) assert.ok(watched.s.tick > skipped.s.tick, "SKIP shortens the celebration");
const best = Math.max(...games.map((g) => g.s.score));
for (const r of fixture.runs as any[])
  verifyCoreFixture(core, r.seed, r.inputs.map(([tick, action]: (string | number)[], seq: number) => ({ seq, tick: Number(tick), action: String(action) })), r.finalTick, 1e9, { score: r.score, status: r.status, failure: r.failure, hash: r.hash });
console.log(`Bowling V1 OK · ten frames · scores ${games.map((g) => g.s.score).join("/")} · best ${best}`);
