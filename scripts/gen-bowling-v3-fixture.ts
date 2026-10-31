import { writeFileSync } from "node:fs";
import { sha256 } from "../lib/server/matchIntegrity";
import { canonicalJson } from "../lib/verified/canonical";
import { generateScenario } from "../lib/server/scenarios";
import { playBowlingV3, varied } from "./bowling-v3-play-fixture";
function run(i: number, spread: number, skip: boolean) {
  const seed = generateScenario({ game_id: "bowling", game_version: "3.0.0" }, i).seed;
  const { s, inputs } = playBowlingV3(seed, varied(seed, spread), skip);
  return { seed, finalTick: s.tick, score: s.score, status: s.status, failure: s.failure, hash: sha256(canonicalJson(s)), inputs: inputs.map((x) => [x.tick, x.action]) };
}
const runs = [run(0, 2, true), run(1, 6, false), run(2, 10, true)];
writeFileSync("scripts/fixtures/bowling-v3.json", JSON.stringify({ gameVersion: "3.0.0", runs }));
console.log(runs.map((r) => `${r.status}/${r.failure} score ${r.score} tick ${r.finalTick} inputs ${r.inputs.length}`).join("\n"));
