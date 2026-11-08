import assert from "node:assert/strict";
import { replayCore, stepCore } from "../lib/verified/coreRuntime.v1";
import {
  PINBALL_CORE_V11 as core, PINBALL_RULES_V11 as R, PINBALL_POSTS_V11, PINBALL_POST_KICK_V11, PINBALL_SLINGS_V11,
  PINBALL_WALLS_V11, PINBALL_INLANES_V11, PINBALL_LSPINNER_V11, pinballBumpersV11, pinballUpperTipV11, copyPinballStateV11,
  type PinballStateV11,
} from "../lib/verified/pinballCore.v11";
import { PINBALL_CORE_V10 } from "../lib/verified/pinballCore.v10";
import { playPinballV11 } from "./pinball-v11-play-fixture";
import fixture from "./fixtures/pinball-v11.json" with { type: "json" };

assert.equal(core.gameVersion, "11.0.0");
assert.equal(PINBALL_CORE_V10.gameVersion, "10.0.0", "V10 stays published");
type Run = { seed: string; finalTick: number; score: number; inputs: [number, string][] };
for (const run of fixture.runs as unknown as Run[]) {
  const inputs = run.inputs.map(([tick, action], seq) => ({ seq, tick, action }));
  const r = replayCore(core, inputs, run.finalTick, run.seed, 1e9);
  assert.ok(r.valid, "replay valid");
  assert.equal(r.state?.score, run.score);
}
assert.ok(fixture.runs.length >= 3, "golden runs present");
const ball = (x: number, y: number, vx = 0, vy = 0) => ({ x, y, vx, vy, xr: 0, yr: 0 });
const play = (seed: string) => { const s = core.create(seed); s.phase = "play"; s.saveUntil = -1; return s; };
const speed = (s: PinballStateV11) => Math.hypot(s.ball.vx, s.ball.vy);

// Every round thing the ball bounces off has its own value.
const bumpers = pinballBumpersV11(0);
const values = [...bumpers.map((b) => b.points), ...PINBALL_POSTS_V11.map((p) => p.points), ...PINBALL_SLINGS_V11.map((p) => p.points)];
assert.equal(new Set(values).size, values.length, "all bounce values differ");
assert.equal(bumpers.length, 6);
// Each bumper fires and scores its own value; bumper storm multiplies it by four.
bumpers.forEach((p, i) => {
  for (const storm of [false, true]) {
    const s = play(`bumper-${i}-${storm}`);
    if (storm) { s.mode = 0; s.modeUntil = 1e6; }
    s.ball = ball(p.x, p.y - p.r - R.radiusMilli - 1500, 0, 60000);
    for (let k = 0; k < 8 && s.bumperFlash[i] < 0; k++) stepCore(core, s, 1e9);
    assert.ok(s.bumperFlash[i] >= 0, `bumper ${i} fires`);
    assert.ok(s.feed.some((e) => e.kind === "BUMPER" && e.points === p.points * (storm ? R.stormFactor : 1)), `bumper ${i} scores ${p.points}${storm ? " ×4" : ""}`);
  }
});
// Posts kick a slow ball away and score their own value once per contact.
PINBALL_POSTS_V11.forEach((p, i) => {
  const s = play(`post-${i}`);
  s.ball = ball(p.x, p.y - p.r - R.radiusMilli - 1500, 0, 60000);
  for (let k = 0; k < 8 && s.posts === 0; k++) stepCore(core, s, 1e9);
  assert.equal(s.posts, 1, `post ${i} hit once`);
  assert.ok(s.feed.some((e) => e.kind === "POST" && e.points === p.points), `post ${i} scores ${p.points}`);
  assert.ok(speed(s) >= PINBALL_POST_KICK_V11 * 0.9 && s.ball.vy < 0, `post ${i} kicks the ball back up`);
});
PINBALL_SLINGS_V11.forEach((p, i) => {
  const s = play(`sling-${i}`);
  s.ball = ball(p.x, p.y - p.r - R.radiusMilli - 1500, 0, 60000);
  for (let k = 0; k < 8 && s.slingFlash[i] < 0; k++) stepCore(core, s, 1e9);
  assert.ok(s.feed.some((e) => e.kind === "SLING" && e.points === p.points), `sling ${i} scores ${p.points}`);
});
// The upper flipper follows the right button and sends a ball resting on it back up.
{
  const s = play("upper");
  const rest = pinballUpperTipV11(R.flipRest);
  s.ball = ball((rest.x + rest.pivot.x) >> 1, ((rest.y + rest.pivot.y) >> 1) - R.radiusMilli - R.flipHalfThickMilli - 1000, 0, 0);
  for (let k = 0; k < 6; k++) stepCore(core, s, 1e9);
  s.rightHeld = true;
  let up = 0;
  for (let k = 0; k < 10; k++) { stepCore(core, s, 1e9); up = Math.min(up, s.ball.vy); }
  assert.ok(up < -250000, `upper flipper flicks the ball up (${up})`);
}
// Left spinner scores 75 a spin when the ball goes up through it.
{
  const s = play("lspin"), z = PINBALL_LSPINNER_V11;
  s.ball = ball((z.x0 + z.x1) >> 1, z.y1 + 4000, 0, -700000);
  for (let k = 0; k < 20; k++) stepCore(core, s, 1e9);
  assert.ok(s.lSpins >= 1 && s.feed.some((e) => e.kind === "LSPINNER" && e.points === R.leftSpinnerPoints), "left spinner spins");
}
// Inlanes: one lights, both give 2500 and a fresh ball save.
{
  const s = play("inlanes");
  for (const [i, l] of PINBALL_INLANES_V11.entries()) {
    s.ball = ball(l.x, l.y, 0, 0); s.tick += 100;
    stepCore(core, s, 1e9);
    assert.equal(s.inlanes[i] || s.inlaneSets, 1, `inlane ${i} lit`);
  }
  assert.equal(s.inlaneSets, 1);
  assert.ok(s.feed.some((e) => e.kind === "INLANES" && e.points === R.inlanesPoints) && s.saveUntil > s.tick, "both inlanes: award + ball save");
}
// Clearance: every circle leaves at least a ball diameter to its neighbours, the walls and the upper flipper.
const D = 2 * R.radiusMilli;
const circles = [...PINBALL_POSTS_V11, ...bumpers, ...PINBALL_SLINGS_V11];
for (const a of circles) for (const b of circles) if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) - a.r - b.r > D, `elements apart (${a.x},${a.y})-(${b.x},${b.y})`);
const segDist = (p: { x: number; y: number }, w: { ax: number; ay: number; bx: number; by: number }) => {
  const abx = w.bx - w.ax, aby = w.by - w.ay, t = Math.max(0, Math.min(1, ((p.x - w.ax) * abx + (p.y - w.ay) * aby) / (abx * abx + aby * aby)));
  return Math.hypot(p.x - w.ax - abx * t, p.y - w.ay - aby * t);
};
for (const c of circles) for (const w of PINBALL_WALLS_V11) assert.ok(segDist(c, w) - c.r > D, "clear of the walls");
for (const angle of [R.flipRest, R.flipUp]) {
  const tip = pinballUpperTipV11(angle), w = { ax: tip.pivot.x, ay: tip.pivot.y, bx: tip.x, by: tip.y };
  for (const c of circles) assert.ok(segDist(c, w) - c.r - R.flipHalfThickMilli > D, "clear of the upper flipper");
}
// No stuck ball for the bot; the same run twice is the same state.
for (let i = 0; i < 4; i++) assert.equal(playPinballV11(`stuck-${i}`, "plunge-only", 3 + i).s.nudges, 0, "no stuck ball");
assert.deepEqual(copyPinballStateV11(playPinballV11("twice", "smart", 6).s), copyPinballStateV11(playPinballV11("twice", "smart", 6).s));
console.log("Pinball V11 OK · 6 bumpers 100–500, 8 posts 15–70, slings 35/55 (all different) · upper flipper · left spinner · inlanes · clearance · golden replay");
