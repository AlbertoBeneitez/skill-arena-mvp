import assert from "node:assert/strict";
import { BIRDS_CORE as core } from "../lib/verified/galacticBirdsCore.v2";
import {
  applyCoreInput,
  stepCore,
  replayCore,
} from "../lib/verified/coreRuntime.v1";
import type { ReplayInput } from "../lib/verified/inputValidation";
let found = false;
for (let seedIndex = 0; seedIndex < 1 && !found; seedIndex++)
  for (const aim of [0]) {
    const seed = `birds-demolition-${seedIndex}`,
      s = core.create(seed),
      original = structuredClone(s),
      inputs: ReplayInput[] = [];
    for (const action of [
      `AIM_${String(aim).padStart(2, "0")}`,
      "POWER_12",
      "SHOOT",
    ]) {
      inputs.push({ seq: inputs.length, tick: s.tick, action });
      assert.ok(applyCoreInput(core, s, action, 1e9));
      stepCore(core, s, 1e9);
    }
    let indirect = false;
    for (let t = 0; t < 1200 && s.status === "running"; t++) {
      const bird = s.bird && { ...s.bird },
        alive = s.enemies.filter((e) => e.alive).map((e) => ({ ...e }));
      stepCore(core, s, 1e9);
      for (const e of alive)
        if (
          !s.enemies[e.id].alive &&
          (!bird || Math.hypot(bird.x - e.x, bird.y - e.y) > 80000)
        )
          indirect = true;
    }
    const collapsed = s.bodies.some(
      (b, i) =>
        !b.alive ||
        Math.abs(b.x - original.bodies[i].x) +
          Math.abs(b.y - original.bodies[i].y) >
          20000,
    );
    if (indirect && collapsed) {
      assert.ok(s.kills > 0);
      assert.equal(s.bodies.length, original.bodies.length);
      const replay = replayCore(core, inputs, s.tick, seed, 1e9);
      assert.equal(replay.error, "CLIENT_ENDED_BEFORE_RESOLUTION");
      assert.deepEqual(replay.state, s);
      console.log(
        `Birds demolition: ${seed}, aim${aim}, support displacement/destruction and indirect target defeat, unchanged persistent field/replay`,
      );
      found = true;
      break;
    }
  }
assert.ok(
  found,
  "An actual seeded shot must demolish supports and defeat targets indirectly",
);
