import assert from "node:assert/strict";
import {
  rouletteBallCanGrab,
  rouletteDragLaunch,
  ROULETTE_BALL_DOCK as dock,
} from "../lib/rouletteGesture";
import { ROULETTE_ACTIONS } from "../lib/verified/galacticRouletteProtocol.v1";
assert.equal(rouletteDragLaunch(dock, dock), null);
assert.equal(rouletteDragLaunch({ x: 100, y: 100 }, { x: 195, y: 195 }), null);
assert.equal(rouletteDragLaunch(dock, { x: 390, y: 400 }), null);
assert.equal(rouletteDragLaunch(dock, { x: NaN, y: 195 }), null);
assert.equal(rouletteBallCanGrab(dock), true);
const actions = new Set<string>();
for (let x = 55; x < 335; x += 7)
  for (let y = 55; y < 335; y += 7) {
    const a = rouletteDragLaunch(dock, { x, y });
    if (a) {
      assert.ok(ROULETTE_ACTIONS.includes(a));
      actions.add(a);
    }
  }
assert.ok([...actions].some((a) => a.startsWith("LAUNCH_CW")));
assert.ok([...actions].some((a) => a.startsWith("LAUNCH_CCW")));
assert.ok(actions.size > 50);
assert.notEqual(
  rouletteDragLaunch(dock, { x: 310, y: 240 }),
  rouletteDragLaunch(dock, { x: 100, y: 140 }),
);
console.log(
  "Roulette drag: dock-only grab, inward release, minimum distance, bounded power, both directions and unchanged replay protocol",
);
