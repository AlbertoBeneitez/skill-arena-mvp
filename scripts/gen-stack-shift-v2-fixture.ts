import { writeFileSync } from "node:fs";
import { generateScenario } from "../lib/server/scenarios";
import { sha256 } from "../lib/server/matchIntegrity";
import { canonicalJson } from "../lib/verified/canonical";
import { STACK_SHIFT_CORE_V2 as core } from "../lib/verified/stackShiftCore.v2";
import { applyCoreInput, stepCore } from "../lib/verified/coreRuntime.v1";
import { chooseStackPlacement } from "./stack-shift-v2-play-fixture";
const seed = generateScenario({ game_id: "stack-shift", game_version: "2.0.0" }, 3).seed;
const s = core.create(seed), inputs: { seq: number; tick: number; action: string }[] = [];
let plan: ReturnType<typeof chooseStackPlacement> | null = null;
while (s.status === "running") {
  if (s.pieceActive) {
    plan ??= chooseStackPlacement(s);
    const a = s.rotation !== plan.rotation ? "ROTATE" : s.x !== plan.x ? (s.x > plan.x ? "LEFT" : "RIGHT") : "HARD_DROP";
    if (core.canApply(s, a)) { inputs.push({ seq: inputs.length, tick: s.tick, action: a }); applyCoreInput(core, s, a, 1e6); if (a === "HARD_DROP") plan = null; }
  }
  stepCore(core, s, 1e6);
}
writeFileSync("scripts/fixtures/stack-shift-v2.json", JSON.stringify({ seed, inputs, score: s.score, finalTick: s.tick, status: s.status, hash: sha256(canonicalJson(s)) }, null, 1));
console.log(s.status, s.lines, s.score, s.tick, inputs.length);
