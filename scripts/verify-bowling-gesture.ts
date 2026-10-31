import assert from "node:assert/strict";
import { strokeOf, throwFromStroke, type StrokePoint } from "../lib/bowlingGesture.v3";

// Direction = the straight line from the start of the stroke to its end; spin = the drawn line's bend away from it.
const line = (x0: number, x1: number, bow: number, ms = 12, n = 20): StrokePoint[] =>
  Array.from({ length: n + 1 }, (_, i) => { const k = i / n; return { x: x0 + (x1 - x0) * k + bow * Math.sin(Math.PI * k), y: 700 - 300 * k, t: i * ms }; });
const th = (path: StrokePoint[]) => { const r = throwFromStroke(strokeOf({ path })); assert.ok(r, "a throw"); return r!; };
const straight = th(line(195, 195, 0));
assert.deepEqual([straight.angle, straight.spin], [24, 8], "straight up: centre angle, no spin");
assert.ok(th(line(195, 225, 0)).angle > 24 && th(line(195, 165, 0)).angle < 24, "slant sets the direction");
assert.equal(th(line(195, 225, 0)).spin, 8, "a straight slanted line has no spin");
assert.ok(th(line(195, 195, -20)).spin > 8 && th(line(195, 195, 20)).spin < 8, "the bend sets the spin");
assert.equal(th(line(195, 195, -20)).angle, 24, "bending does not change the direction (chord)");
assert.equal(th(line(195, 225, -20)).angle, th(line(195, 225, 0)).angle, "direction is the chord even when curved");
// Sensitive: 10 px of slant over a 300 px stroke already moves the angle, a 6 px bow already moves the spin.
assert.ok(th(line(195, 205, 0)).angle >= 26, "10 px slant moves the angle");
assert.notEqual(th(line(195, 195, -8)).spin, 8, "a small bow is spin");
assert.equal(th(line(195, 196, 1)).spin, 8, "wobble is ignored");
// A sideways aim drag before the upward stroke is not part of the throw.
const aimThenUp = [{ x: 100, y: 700, t: 0 }, { x: 160, y: 705, t: 40 }, ...line(160, 160, 0).map((p) => ({ ...p, t: p.t + 60 }))];
assert.deepEqual([th(aimThenUp).angle, th(aimThenUp).spin], [24, 8]);
// Power follows the flick speed; a short or downward stroke is not a throw.
assert.ok(th(line(195, 195, 0, 4)).power > th(line(195, 195, 0, 20)).power, "a faster flick is more power");
assert.equal(throwFromStroke(strokeOf({ path: line(195, 195, 0).slice(0, 2) })), null);
console.log("Bowling gesture OK · chord → direction · bend → spin · flick → power");
