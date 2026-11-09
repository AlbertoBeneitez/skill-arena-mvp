import assert from "node:assert/strict";
import { replayCore, stepCore } from "../lib/verified/coreRuntime.v1";
import {
  PINBALL_CORE_V14 as core, PINBALL_RULES_V14 as R, PINBALL_POSTS_V14, PINBALL_POST_KICK_V14, PINBALL_SLINGS_V14,
  PINBALL_WALLS_V14, PINBALL_INLANES_V14, PINBALL_LSPINNER_V14, PINBALL_MOUTHS_V14, PINBALL_ORBIT_ZONES_V14,
  PINBALL_TUBES_V14, PINBALL_DROPS_V14, PINBALL_WORMHOLE_V14, PINBALL_DIVIDERS_V14, PINBALL_STARS_V14, pinballBumpersV14, pinballUpperTipV14, copyPinballStateV14,
  type PinballStateV14,
} from "../lib/verified/pinballCore.v14";
import { PINBALL_CORE_V13 } from "../lib/verified/pinballCore.v13";
import { playPinballV14 } from "./pinball-v14-play-fixture";
import fixture from "./fixtures/pinball-v14.json" with { type: "json" };

assert.equal(core.gameVersion, "14.0.0");
assert.equal(PINBALL_CORE_V13.gameVersion, "13.0.0", "V13 stays published");
type Run = { seed: string; finalTick: number; score: number; inputs: [number, string][] };
for (const run of fixture.runs as unknown as Run[]) {
  const inputs = run.inputs.map(([tick, action], seq) => ({ seq, tick, action }));
  const r = replayCore(core, inputs, run.finalTick, run.seed, 1e9);
  assert.ok(r.valid, "replay valid");
  assert.equal(r.state?.score, run.score);
}
assert.ok(fixture.runs.length >= 3, "golden runs present");
// V14: the upper table is stretched upward — the arch top is at y 12 (was 42) and the lower table is unchanged.
assert.ok(PINBALL_WALLS_V14.some((w) => w.ay === 12000 && w.by === 12000), "top arch at y 12");
assert.ok(PINBALL_WALLS_V14.some((w) => w.ax === 18000 && w.ay === 462000 && w.bx === 118000 && w.by === 546000), "lower guides unchanged");
{
  const s = core.create("reach");
  let minY = 1e9;
  for (let k = 0; k < 600 && s.status === "running"; k++) {
    if (s.phase === "lane") { if (!s.chargeHeld) core.apply(s, "PLUNGER_HOLD"); else if (s.charge >= 8 * 8) core.apply(s, "PLUNGER_RELEASE"); }
    stepCore(core, s, 1e9);
    if (s.phase === "play") minY = Math.min(minY, s.ball.y);
  }
  assert.ok(minY < 40000, `a full launch reaches the new top band (${minY})`);
}
const ball = (x: number, y: number, vx = 0, vy = 0) => ({ x, y, vx, vy, xr: 0, yr: 0 });
const play = (seed: string) => { const s = core.create(seed); s.phase = "play"; s.saveUntil = -1; return s; };
const speed = (s: PinballStateV14) => Math.hypot(s.ball.vx, s.ball.vy);
const run = (s: PinballStateV14, n: number, until?: () => boolean) => { for (let k = 0; k < n && !(until?.()); k++) stepCore(core, s, 1e9); };

// Every round thing the ball bounces off has its own value.
const bumpers = pinballBumpersV14(0);
const values = [...bumpers.map((b) => b.points), ...PINBALL_POSTS_V14.map((p) => p.points), ...PINBALL_SLINGS_V14.map((p) => p.points), ...PINBALL_DIVIDERS_V14.map((d) => d.points)];
assert.equal(new Set(values).size, values.length, "all bounce values differ");
assert.equal(bumpers.length, 5);
bumpers.forEach((p, i) => {
  for (const storm of [false, true]) {
    const s = play(`bumper-${i}-${storm}`);
    if (storm) { s.mode = 0; s.modeUntil = 1e6; }
    s.ball = ball(p.x, p.y - p.r - R.radiusMilli - 1500, 0, 60000);
    run(s, 8, () => s.bumperFlash[i] >= 0);
    assert.ok(s.feed.some((e) => e.kind === "BUMPER" && e.points === p.points * (storm ? R.stormFactor : 1)), `bumper ${i} scores ${p.points}${storm ? " ×4" : ""}`);
  }
});
PINBALL_POSTS_V14.forEach((p, i) => {
  const s = play(`post-${i}`);
  s.ball = ball(p.x, p.y - p.r - R.radiusMilli - 1500, 0, 60000);
  run(s, 8, () => s.posts > 0);
  assert.equal(s.posts, 1, `post ${i} hit once`);
  assert.ok(s.feed.some((e) => e.kind === "POST" && e.points === p.points), `post ${i} scores ${p.points}`);
  assert.ok(speed(s) >= PINBALL_POST_KICK_V14 * 0.9 && s.ball.vy < 0, `post ${i} kicks the ball back up`);
});
// The upper flipper (now beside the right sling) follows the right button and flicks a ball resting on it.
{
  const s = play("upper");
  const rest = pinballUpperTipV14(R.flipRest);
  s.ball = ball((rest.x + rest.pivot.x) >> 1, ((rest.y + rest.pivot.y) >> 1) - R.radiusMilli - R.flipHalfThickMilli - 1000, 0, 0);
  run(s, 6);
  s.rightHeld = true;
  let up = 0;
  for (let k = 0; k < 10; k++) { stepCore(core, s, 1e9); up = Math.min(up, s.ball.vy); }
  assert.ok(up < -250000, `upper flipper flicks the ball up (${up})`);
}
{
  const s = play("lspin"), z = PINBALL_LSPINNER_V14;
  s.ball = ball((z.x0 + z.x1) >> 1, z.y1 + 4000, 0, -700000);
  run(s, 20);
  assert.ok(s.lSpins >= 1 && s.feed.some((e) => e.kind === "LSPINNER" && e.points === R.leftSpinnerPoints), "left spinner spins");
}
{
  const s = play("inlanes");
  for (const [i, l] of PINBALL_INLANES_V14.entries()) {
    s.ball = ball(l.x, l.y, 0, 0); s.tick += 100;
    stepCore(core, s, 1e9);
    assert.equal(s.inlanes[i] || s.inlaneSets, 1, `inlane ${i} lit`);
  }
  assert.ok(s.feed.some((e) => e.kind === "INLANES" && e.points === R.inlanesPoints) && s.saveUntil > s.tick, "both inlanes: award + ball save");
}
// Ramps: a ball rolled up the axis of a mouth rides its ramp to its own inlane; each ramp shot is worth 500 more.
for (const [side, m] of PINBALL_MOUTHS_V14.entries()) {
  const s = play(`ramp-${side}`);
  for (let shot = 0; shot < 2; shot++) {
    s.ball = ball(m.x - m.ux * 30, m.y - m.uy * 30, m.ux * 700, m.uy * 700);
    s.rampTicks = [-1000, -1000]; s.tubeUntil = 0;
    run(s, 40, () => s.tube >= 0);
    assert.equal(s.tube, 3 + side, `mouth ${side} catches the ball (shot ${shot})`);
    assert.ok(s.feed.some((e) => e.kind === "RAMP" && e.points === R.rampStart + shot * R.rampStep), `ramp ${side} worth ${R.rampStart + shot * R.rampStep}`);
    run(s, 600, () => s.tube < 0);
    const end = PINBALL_TUBES_V14[3 + side].path.at(-1)!;
    assert.ok(Math.abs(s.ball.x - end.x) < 12000 && Math.abs(s.ball.y - end.y) < 12000, `ramp ${side} returns to its inlane`);
    assert.ok(s.feed.some((e) => e.kind === "RAIL"), "ramp exit award");
    assert.ok(side === 0 ? s.ball.x < 195000 : s.ball.x > 195000, "back on its own side");
  }
  // A slow ball rolls back out; a ball falling onto the back of the mouth bounces off.
  const slow = play(`slow-${side}`);
  slow.ball = ball(m.x - m.ux * 20, m.y - m.uy * 20, m.ux * 90, m.uy * 90);
  run(slow, 120);
  assert.equal(slow.ramps, 0, `slow ball not caught by mouth ${side}`);
  const back = play(`back-${side}`);
  back.ball = ball(m.x + m.ux * 60, m.y + m.uy * 60 - 20000, 0, 100000);
  run(back, 90);
  assert.equal(back.ramps, 0, `ball from behind not caught by mouth ${side}`);
}
// Orbits: going up a wall loops round the top and out on the other side, among the bumpers.
for (const [side, z] of PINBALL_ORBIT_ZONES_V14.entries()) {
  const s = play(`orbit-${side}`);
  s.ball = ball((z.x0 + z.x1) >> 1, z.y1 + 20000, 0, -650000);
  run(s, 30, () => s.tube >= 0);
  assert.equal(s.tube, side, `orbit ${side} caught`);
  run(s, 600, () => s.tube < 0);
  assert.ok(side === 0 ? s.ball.x > 250000 : s.ball.x < 140000, `orbit ${side} comes out on the other side`);
  assert.ok(s.feed.some((e) => e.kind === "ORBIT" && e.points === 1500));
}
// The scoop is roofed: a ball falling from the bumpers glances off and never feeds itself into it.
for (const x of [170000, 195000, 220000]) {
  const s = play(`roof-${x}`);
  s.ball = ball(x, 240000, 0, 0);
  run(s, 240);
  assert.equal(s.wormholes, 0, `ball falling at ${x} glances off the roof`);
}
// The scoop is reachable from below only through a dropped middle target.
{
  const s = play("scoop-closed");
  s.ball = ball(PINBALL_WORMHOLE_V14.x, 400000, 0, -600000);
  run(s, 40);
  assert.equal(s.wormholes, 0, "standing middle drop guards the scoop");
  assert.ok(s.drops[1] === 1 || s.feed.some((e) => e.kind === "DROP"), "it knocks the middle drop down");
  s.ball = ball(PINBALL_WORMHOLE_V14.x, 400000, 0, -600000);
  run(s, 40, () => s.tube === 2);
  assert.equal(s.tube, 2, "with the middle drop down the scoop takes the ball");
}
// V14: smooth passages — consecutive path segments never turn more than 25° (no polyline corners).
for (const [i, t] of PINBALL_TUBES_V14.entries()) {
  for (let k = 2; k < t.path.length; k++) {
    const a = t.path[k - 2], b = t.path[k - 1], c = t.path[k];
    const a1 = Math.atan2(b.y - a.y, b.x - a.x), a2 = Math.atan2(c.y - b.y, c.x - b.x);
    let d = Math.abs(a2 - a1); if (d > Math.PI) d = 2 * Math.PI - d;
    assert.ok(d < (25 * Math.PI) / 180, `tube ${i} turns smoothly at point ${k} (${Math.round((d * 180) / Math.PI)}°)`);
  }
}
// V14: the middle dividers kick a slow ball and score their own value; the centre lane between them stays open.
PINBALL_DIVIDERS_V14.forEach((dv, i) => {
  const s = play(`divider-${i}`), mx = (dv.ax + dv.bx) >> 1, my = (dv.ay + dv.by) >> 1, side = i ? 1 : -1;
  s.ball = ball(mx + side * (dv.r + R.radiusMilli + 1500), my, -side * 60000, 0);
  run(s, 8, () => s.dividerFlash[i] >= 0);
  assert.ok(s.feed.some((e) => e.kind === "DIVIDER" && e.points === dv.points), `divider ${i} scores ${dv.points}`);
  assert.ok(speed(s) >= PINBALL_POST_KICK_V14 * 0.9, `divider ${i} kicks the ball`);
});
{
  const [l, r] = PINBALL_DIVIDERS_V14;
  assert.ok(Math.min(r.ax, r.bx) - r.r - (Math.max(l.ax, l.bx) + l.r) > 2 * R.radiusMilli, "centre lane wider than a ball");
}
// V14: star rollovers down the centre lane: 100 each, all three 2000.
{
  const s = play("stars");
  for (const st of PINBALL_STARS_V14) { s.ball = ball(st.x, st.y, 0, -50000); s.tick += 60; stepCore(core, s, 1e9); }
  assert.equal(s.starSets, 1, "three stars make a set");
  assert.ok(s.feed.some((e) => e.kind === "STARS" && e.points === R.starsPoints), "stars award");
}
// Clearance: every circle leaves at least a ball diameter to its neighbours, the walls (mouths included) and the
// upper flipper; the drops leave the mouths a ball diameter.
const D = 2 * R.radiusMilli;
const circles = [...PINBALL_POSTS_V14, ...bumpers, ...PINBALL_SLINGS_V14];
for (const a of circles) for (const b of circles) if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) - a.r - b.r > D, `elements apart (${a.x},${a.y})-(${b.x},${b.y})`);
const segDist = (p: { x: number; y: number }, w: { ax: number; ay: number; bx: number; by: number }) => {
  const abx = w.bx - w.ax, aby = w.by - w.ay, t = Math.max(0, Math.min(1, ((p.x - w.ax) * abx + (p.y - w.ay) * aby) / (abx * abx + aby * aby)));
  return Math.hypot(p.x - w.ax - abx * t, p.y - w.ay - aby * t);
};
for (const c of circles) for (const w of PINBALL_WALLS_V14) assert.ok(segDist(c, w) - c.r > D, `(${c.x},${c.y}) clear of the walls`);
for (const c of circles) for (const dv of PINBALL_DIVIDERS_V14) assert.ok(segDist(c, dv) - c.r - dv.r > D, `(${c.x},${c.y}) clear of the dividers`);
for (const dv of PINBALL_DIVIDERS_V14) for (const w of [...PINBALL_WALLS_V14, ...PINBALL_DROPS_V14]) {
  const gap = Math.min(segDist({ x: dv.ax, y: dv.ay }, w), segDist({ x: dv.bx, y: dv.by }, w)) - dv.r;
  assert.ok(gap > D, `divider clear of walls and drops (${gap})`);
}
for (const angle of [R.flipRest, R.flipUp]) {
  const tip = pinballUpperTipV14(angle), w = { ax: tip.pivot.x, ay: tip.pivot.y, bx: tip.x, by: tip.y };
  for (const c of circles) assert.ok(segDist(c, w) - c.r - R.flipHalfThickMilli > D, "clear of the upper flipper");
}
// Between the drop bank and the mouths every gap is either sealed (narrower than the ball) or wider than a ball.
for (const d of PINBALL_DROPS_V14) for (const w of PINBALL_WALLS_V14.slice(-8, -2)) {
  const gap = Math.min(...[{ x: d.ax, y: d.ay }, { x: d.bx, y: d.by }].map((p) => segDist(p, w)));
  assert.ok(gap < R.radiusMilli * 1.4 || gap > D, `drop bank gap to a mouth is sealed or open (${gap})`);
}
// No stuck ball for the bots; the same run twice is the same state.
for (let i = 0; i < 6; i++) assert.equal(playPinballV14(`stuck-${i}`, i % 2 ? "plunge-only" : "smart", 3 + i).s.nudges, 0, "no stuck ball");
assert.deepEqual(copyPinballStateV14(playPinballV14("twice", "smart", 6).s), copyPinballStateV14(playPinballV14("twice", "smart", 6).s));
console.log("Pinball V14 OK · smooth passages · middle dividers 40/60 · star rollovers · ramps mid-field (1500→+500, back to their inlanes) · orbits loop the top · roofed scoop behind the V bank · 5 bumpers, 7 posts, 2 slings all different · clearance · golden replay");
