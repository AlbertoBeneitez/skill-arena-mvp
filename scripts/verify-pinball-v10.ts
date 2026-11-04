import assert from "node:assert/strict";
import { replayCore, stepCore } from "../lib/verified/coreRuntime.v1";
import {
  PINBALL_CORE_V10 as core, PINBALL_RULES_V10 as R, PINBALL_POSTS_V10, PINBALL_POST_KICK_V10, PINBALL_SLINGS_V10, PINBALL_SLING_KICK_V10,
  PINBALL_BUMPER_RADIUS_V10, PINBALL_WALLS_V10, pinballBumpersV10, copyPinballStateV10, type PinballStateV10,
} from "../lib/verified/pinballCore.v10";
import { PINBALL_CORE_V9 } from "../lib/verified/pinballCore.v9";
import { playPinballV10 } from "./pinball-v10-play-fixture";
import fixture from "./fixtures/pinball-v10.json" with { type: "json" };

assert.equal(core.gameVersion, "10.0.0");
assert.equal(PINBALL_CORE_V9.gameVersion, "9.0.0", "V9 stays published");
// Golden runs replay to the same score and state.
type Run = { seed: string; finalTick: number; score: number; inputs: [number, string][] };
for (const run of fixture.runs as unknown as Run[]) {
  const inputs = run.inputs.map(([tick, action], seq) => ({ seq, tick, action }));
  const r = replayCore(core, inputs, run.finalTick, run.seed, 1e9);
  assert.ok(r.valid, "replay valid");
  assert.equal(r.state?.score, run.score);
}
const ball = (x: number, y: number, vx = 0, vy = 0) => ({ x, y, vx, vy, xr: 0, yr: 0 });
const play = (seed: string) => { const s = core.create(seed); s.phase = "play"; s.saveUntil = -1; return s; };
const speed = (s: PinballStateV10) => Math.hypot(s.ball.vx, s.ball.vy);
// Every rubber post kicks a slow ball away and scores once per contact.
PINBALL_POSTS_V10.forEach((p, i) => {
  const s = play(`post-${i}`);
  s.ball = ball(p.x, p.y - p.r - R.radiusMilli - 1500, 0, 60000);
  for (let k = 0; k < 8 && s.posts === 0; k++) stepCore(core, s, 1e9);
  assert.equal(s.posts, 1, `post ${i} hit once`);
  assert.ok(s.feed.some((e) => e.kind === "POST" && e.points === p.points), `post ${i} scores ${p.points}`);
  assert.ok(speed(s) >= PINBALL_POST_KICK_V10 * 0.9, `post ${i} kicks the ball`);
  assert.ok(s.ball.vy < 0, `post ${i} sends the ball back up`);
});
// The fifth bumper is live.
{
  const p = pinballBumpersV10(0)[4], s = play("bumper-5");
  s.ball = ball(p.x, p.y - PINBALL_BUMPER_RADIUS_V10 - R.radiusMilli - 1500, 0, 60000);
  for (let k = 0; k < 8 && s.bumperFlash[4] < 0; k++) stepCore(core, s, 1e9);
  assert.ok(s.bumperFlash[4] >= 0, "fifth bumper fires");
}
// Slings kick harder than in V9.
{
  const p = PINBALL_SLINGS_V10[0], s = play("sling");
  s.ball = ball(p.x, p.y - p.r - R.radiusMilli - 1500, 0, 60000);
  for (let k = 0; k < 8 && s.slingFlash[0] < 0; k++) stepCore(core, s, 1e9);
  assert.ok(s.slingFlash[0] >= 0 && speed(s) >= PINBALL_SLING_KICK_V10 * 0.9, "sling kicks at 420 px/s");
}
// Clearance: every new element leaves at least a ball diameter to its neighbours and the walls.
const D = 2 * R.radiusMilli;
const circles = [...PINBALL_POSTS_V10.map((p) => ({ x: p.x, y: p.y, r: p.r })), ...pinballBumpersV10(0).map((p) => ({ ...p, r: PINBALL_BUMPER_RADIUS_V10 })), ...PINBALL_SLINGS_V10];
for (const a of circles) for (const b of circles) if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) - a.r - b.r > D, "elements apart");
const segDist = (p: { x: number; y: number }, w: { ax: number; ay: number; bx: number; by: number }) => {
  const abx = w.bx - w.ax, aby = w.by - w.ay, t = Math.max(0, Math.min(1, ((p.x - w.ax) * abx + (p.y - w.ay) * aby) / (abx * abx + aby * aby)));
  return Math.hypot(p.x - w.ax - abx * t, p.y - w.ay - aby * t);
};
for (const c of circles) for (const w of PINBALL_WALLS_V10) assert.ok(segDist(c, w) - c.r > D, "clear of the walls");
// The bot never needs the stuck nudge on the new table.
for (let i = 0; i < 4; i++) assert.equal(playPinballV10(`stuck-${i}`, "plunge-only", 3 + i).s.nudges, 0, "no stuck ball");
// Determinism: the same run twice is the same state.
assert.deepEqual(copyPinballStateV10(playPinballV10("twice", "smart", 6).s), copyPinballStateV10(playPinballV10("twice", "smart", 6).s));
console.log("Pinball V10 OK · 5 bumpers · 3 rubber posts + 2 lane separators (kick, 50/10) · slings 420 px/s 50 · clearance ≥ one ball · golden replay");
