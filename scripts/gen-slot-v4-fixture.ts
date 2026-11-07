import { writeFileSync } from "node:fs";
import { sha256 } from "../lib/server/matchIntegrity";
import { canonicalJson } from "../lib/verified/canonical";
import { generateScenario } from "../lib/server/scenarios";
import { playSlotV4 } from "./slot-v4-play-fixture";
function run(i: number, mode: "greedy" | "plain", spins: number) {
  const seed = generateScenario({ game_id: "galactic-slot", game_version: "4.0.0" }, i).seed;
  const { s, inputs } = playSlotV4(seed, mode, spins);
  return { seed, finalTick: s.tick, score: s.score, status: s.status, failure: s.failure, hash: sha256(canonicalJson(s)), inputs: inputs.map((x) => [x.tick, x.action]) };
}
const runs = [run(0, "greedy", 30), run(1, "plain", 60)];
writeFileSync("scripts/fixtures/slot-v4.json", JSON.stringify({ gameVersion: "4.0.0", runs }));
console.log(runs.map((r) => `${r.status}/${r.failure} score ${r.score} tick ${r.finalTick} inputs ${r.inputs.length}`).join("\n"));
