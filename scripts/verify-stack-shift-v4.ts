import assert from "node:assert/strict";
import { STACK_SHIFT_CORE_V4 as core, stackPiece } from "../lib/verified/stackShiftCore.v4";
import { applyCoreInput, stepCore, replayCore } from "../lib/verified/coreRuntime.v1";
import { chooseStackPlacement } from "./stack-shift-v4-play-fixture";
import { generateScenario } from "../lib/server/scenarios";
import { verifyCoreFixture } from "./core-test-utils";
import fixture from "./fixtures/stack-shift-v4.json" with { type: "json" };
assert.equal(core.gameVersion, "4.0.0");
verifyCoreFixture(core, fixture.seed, fixture.inputs as never, fixture.finalTick, 1e6, { score: fixture.score, status: "won", failure: null, hash: fixture.hash });
// The opening pieces change from match to match; the board always starts clear (no loose floor blocks).
const openings = new Set<string>();
for (let i = 0; i < 300; i++) {
  const seed = generateScenario({ game_id: "stack-shift", game_version: "4.0.0" }, i).seed, s = core.create(seed);
  assert.deepEqual(core.create(seed), s);
  openings.add([0, 1, 2, 3].map((n) => stackPiece(seed, n)).join(""));
  assert.ok(s.board.every((row) => row.every((v) => v === 0)), "clear board at start");
  assert.ok([0, 1, 3].includes(stackPiece(seed, 0)), "easy first piece");
}
assert.ok(openings.size >= 20, `openings ${openings.size}`);
// Bot play with common replay.
let wins = 0;
for (let i = 0; i < 32; i++) {
  const seed = generateScenario({ game_id: "stack-shift", game_version: "4.0.0" }, i).seed, s = core.create(seed), inputs: { seq: number; tick: number; action: string }[] = [];
  let plan: ReturnType<typeof chooseStackPlacement> | null = null;
  while (s.status === "running") {
    if (s.pieceActive) {
      plan ??= chooseStackPlacement(s);
      const a = s.rotation !== plan.rotation ? "ROTATE" : s.x !== plan.x ? (s.x > plan.x ? "LEFT" : "RIGHT") : "HARD_DROP";
      if (core.canApply(s, a)) { inputs.push({ seq: inputs.length, tick: s.tick, action: a }); applyCoreInput(core, s, a, 1e6); if (a === "HARD_DROP") plan = null; }
    }
    stepCore(core, s, 1e6);
  }
  assert.deepEqual(replayCore(core, inputs, s.tick, seed, 1e6).state, s);
  if (s.status === "won") wins++;
}
assert.ok(wins >= 22, `wins ${wins}`);
console.log(`Stack Shift V4 OK: clear board, varied openings (${openings.size}), ${wins}/32 bot wins`);
