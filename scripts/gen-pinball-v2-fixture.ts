import { writeFileSync } from "node:fs";
import { sha256 } from "../lib/server/matchIntegrity";
import { canonicalJson } from "../lib/verified/canonical";
import { generateScenario } from "../lib/server/scenarios";
import { playPinballV2 } from "./pinball-v2-play-fixture";
// One full-minute run and two drained runs (same bot level), picked deterministically.
function run(i: number, level: number) {
  const seed = generateScenario({ game_id: "pinball", game_version: "2.0.0" }, i).seed;
  const { s, inputs } = playPinballV2(seed, "smart", level);
  return { seed, finalTick: s.tick, score: s.score, status: s.status, failure: s.failure, hash: sha256(canonicalJson(s)), inputs: inputs.map((x) => [x.tick, x.action]) };
}
const runs: ReturnType<typeof run>[] = [];
for (const want of ["TIME_LIMIT", "BALLS_LOST"])
  for (let i = 0, n = 0; i < 60 && n < (want === "TIME_LIMIT" ? 1 : 2); i++) {
    const r = run(i, 7);
    if (r.failure === want && r.score > 2000) { runs.push(r); n++; }
  }
writeFileSync("scripts/fixtures/pinball-v2.json", JSON.stringify({ gameVersion: "2.0.0", runs }));
console.log(runs.map((r) => `${r.status}/${r.failure} score ${r.score} tick ${r.finalTick} inputs ${r.inputs.length}`).join("\n"));
