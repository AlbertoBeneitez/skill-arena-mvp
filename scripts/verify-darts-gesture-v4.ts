import assert from "node:assert/strict";
import { dartsFlickAimV4 } from "../lib/verified/dartsGesture.v4";
import { dartsFlickAimV3 } from "../lib/verified/dartsGesture.v3";

// A flick sampled every 16 ms: a slow wind-up from y0, then the release at `speed` px/ms with sideways drift `vx`.
function flick(x0: number, speed: number, vx = 0, windUp = 6, steps = 8, y0 = 560) {
  const path = [] as { x: number; y: number; t: number }[];
  let x = x0, y = y0, t = 0;
  for (let i = 0; i < windUp; i++) { path.push({ x, y, t }); y -= 3; t += 16; }
  for (let i = 0; i < steps; i++) { path.push({ x, y, t }); y -= speed * 16; x += vx * 16; t += 16; }
  path.push({ x, y, t });
  return path;
}
const centre = dartsFlickAimV4(flick(195, 1.43))!;
assert.ok(Math.abs(centre.y - 30) <= 1 && centre.x === 30, `a natural straight flick lands on the bull (${centre.x},${centre.y})`);
assert.ok(dartsFlickAimV4(flick(195, 1.5, 0.3))!.x > 30, "a flick to the right lands right");
assert.ok(dartsFlickAimV4(flick(195, 1.5, -0.3))!.x < 30, "a flick to the left lands left");
assert.equal(dartsFlickAimV4(flick(195, 0.2)), null, "a lazy push is not a throw");
assert.equal(dartsFlickAimV4([{ x: 195, y: 500, t: 0 }, { x: 195, y: 520, t: 80 }]), null, "a downward drag is not a throw");
// More influence of the movement: the whole board height is reachable with natural flicks (0.6–2.6 px/ms).
const ys: number[] = [];
for (let v = 0.6; v <= 2.6; v += 0.1) for (const steps of [5, 8, 11]) { const a = dartsFlickAimV4(flick(195, v, 0, 6, steps)); if (a) ys.push(a.y); }
assert.ok(Math.max(...ys) >= 57, `the bottom double is reachable (max ${Math.max(...ys)})`);
assert.ok(Math.min(...ys) <= 3, `the top double is reachable (min ${Math.min(...ys)})`);
// V3 could not reach the bottom with the same flicks.
const v3 = Math.max(...[0.6, 0.8, 1.0].map((v) => dartsFlickAimV3(flick(195, v))!.y));
assert.ok(v3 < 57, `V3 bottom limit ${v3}`);
// Monotonic in speed (faster lands higher) and in release height (a later, higher release lands higher).
let last = 61;
for (let v = 0.5; v <= 3.5; v += 0.1) { const y = dartsFlickAimV4(flick(195, v))!.y; assert.ok(y <= last); last = y; }
last = 61;
for (let steps = 4; steps <= 14; steps++) { const y = dartsFlickAimV4(flick(195, 1.4, 0, 6, steps))!.y; assert.ok(y <= last, "a longer flick (higher release) lands higher"); last = y; }
// Wind-up is ignored: a long slow wind-up from lower down, released at the same point and speed, lands the same.
const a = dartsFlickAimV4(flick(195, 1.4, 0, 6, 8))!, b = dartsFlickAimV4(flick(195, 1.4, 0, 30, 8, 560 + 24 * 3))!;
assert.deepEqual([a.x, a.y], [b.x, b.y]);
console.log(`Darts gesture V4: speed + release height decide the height (whole board reachable: ${Math.min(...ys)}..${Math.max(...ys)}; V3 bottom ${v3})`);
