import assert from "node:assert/strict";
import {
  stickDirection,
  type StickDirection,
} from "../lib/directionalJoystick";
// Finger paths: diagonals retain their axis until a deliberate crossing;
// returning to the neutral circle always produces STOP.
for (const prior of [
  "UP",
  "DOWN",
  "LEFT",
  "RIGHT",
  "STOP",
] as StickDirection[]) {
  assert.equal(stickDirection(0, 0, prior), "STOP");
  assert.equal(stickDirection(0.1, 0.1, prior), "STOP");
  assert.equal(stickDirection(-0.8, 0, prior), "LEFT");
  assert.equal(stickDirection(0.8, 0, prior), "RIGHT");
  assert.equal(stickDirection(0, -0.8, prior), "UP");
  assert.equal(stickDirection(0, 0.8, prior), "DOWN");
}
let heading: StickDirection = "RIGHT";
for (let i = 0; i < 200; i++) {
  heading = stickDirection(0.6, 0.6 + Math.sin(i) * 0.05, heading);
  assert.equal(heading, "RIGHT", "diagonal jitter does not flood turn inputs");
}
heading = stickDirection(0.5, 0.8, heading);
assert.equal(heading, "DOWN");
assert.equal(stickDirection(0.6, 0.58, heading), "DOWN");
assert.equal(stickDirection(0.85, 0.5, heading), "RIGHT");
assert.equal(
  stickDirection(5, -1, "UP"),
  "RIGHT",
  "captured finger outside ring retains the intended direction",
);
console.log(
  "Joystick: cardinal input, neutral stop, diagonal hysteresis and captured out-of-ring paths",
);
