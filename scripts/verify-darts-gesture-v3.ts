import assert from "node:assert/strict";
import { dartsFlickAimV3 } from "../lib/verified/dartsGesture.v3";

// A flick sampled every 16 ms: a slow wind-up, then the release at `speed` px/ms with sideways drift `vx`.
function flick(x0: number, speed: number, vx = 0, windUp = 6) {
  const path = [] as { x: number; y: number; t: number }[];
  let x = x0, y = 560, t = 0;
  for (let i = 0; i < windUp; i++) { path.push({ x, y, t }); y -= 3; t += 16; }
  for (let i = 0; i < 8; i++) { path.push({ x, y, t }); y -= speed * 16; x += vx * 16; t += 16; }
  path.push({ x, y, t });
  return path;
}
const centre = dartsFlickAimV3(flick(195, 1.5))!;
assert.deepEqual([centre.x, centre.y], [30, 30], "an ideal straight flick from the centre lands on the bull");
assert.ok(dartsFlickAimV3(flick(195, 0.9))!.y > 30, "a soft flick drops low");
assert.ok(dartsFlickAimV3(flick(195, 2.4))!.y < 30, "a hard flick flies high");
assert.ok(dartsFlickAimV3(flick(195, 1.5, 0.3))!.x > 30, "a flick to the right lands right");
assert.ok(dartsFlickAimV3(flick(195, 1.5, -0.3))!.x < 30, "a flick to the left lands left");
assert.ok(dartsFlickAimV3(flick(260, 1.5))!.x > 30, "releasing right of centre shifts right");
assert.equal(dartsFlickAimV3(flick(195, 0.2)), null, "a lazy push is not a throw");
assert.equal(dartsFlickAimV3([{ x: 195, y: 500, t: 0 }, { x: 195, y: 520, t: 80 }]), null, "a downward drag is not a throw");
assert.equal(dartsFlickAimV3([{ x: 195, y: 500, t: 0 }]), null, "a tap is not a throw");
// The speed is measured on the flick, not the wind-up: a long slow wind-up does not weaken the throw.
assert.equal(dartsFlickAimV3(flick(195, 1.5, 0, 40))!.y, 30);
// Monotonic: faster always lands higher (or equal after quantisation).
let last = 61;
for (let v = 0.5; v <= 3.5; v += 0.1) { const y = dartsFlickAimV3(flick(195, v))!.y; assert.ok(y <= last); last = y; }
console.log("Darts gesture V3: flick direction/speed decide the landing, wind-up ignored, taps and drags never throw");
