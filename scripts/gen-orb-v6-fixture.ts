import { writeFileSync } from "node:fs";
import { sha256 } from "../lib/server/matchIntegrity";
import { canonicalJson } from "../lib/verified/canonical";
import { generateScenario } from "../lib/server/scenarios";
import { playOrbV6 } from "./orb-v6-play-fixture";
function run(i: number, mode: "smart" | "random", shots: number) {
  const seed = generateScenario({ game_id: "orb-burst", game_version: "6.0.0" }, i).seed;
  const { s, inputs } = playOrbV6(seed, mode, shots);
  return { seed, finalTick: s.tick, score: s.score, status: s.status, failure: s.failure, hash: sha256(canonicalJson(s)), inputs: inputs.map((x) => [x.tick, x.action]) };
}
const runs = [run(0, "smart", 60), run(1, "random", 400)];
writeFileSync("scripts/fixtures/orb-v6.json", JSON.stringify({ gameVersion: "6.0.0", runs }));
console.log(runs.map((r) => `${r.status}/${r.failure} score ${r.score} tick ${r.finalTick} inputs ${r.inputs.length}`).join("\n"));
