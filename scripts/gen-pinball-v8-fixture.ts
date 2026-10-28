import { writeFileSync } from "node:fs";
import { sha256 } from "../lib/server/matchIntegrity";
import { canonicalJson } from "../lib/verified/canonical";
import { generateScenario } from "../lib/server/scenarios";
import { playPinballV8 } from "./pinball-v8-play-fixture";
function run(i: number, level: number, mode: "smart" | "plunge-only" = "smart") {
  const seed = generateScenario({ game_id: "pinball", game_version: "8.0.0" }, i).seed;
  const { s, inputs } = playPinballV8(seed, mode, level);
  return { seed, drains: s.drains, finalTick: s.tick, score: s.score, status: s.status, failure: s.failure, hash: sha256(canonicalJson(s)), inputs: inputs.map((x) => [x.tick, x.action]) };
}
const runs: ReturnType<typeof run>[] = [];
// The clock always ends the game (TIME_LIMIT); keep two clean runs and one that includes a centre drain.
for (let i = 0; i < 80 && runs.length < 2; i++) {
  const r = run(i, 7);
  if (r.failure === "TIME_LIMIT" && r.score > 2000) runs.push(r);
}
for (let i = 0; i < 20 && runs.length < 3; i++) {
  const r = run(i, 5, "plunge-only");
  if (r.failure === "TIME_LIMIT" && r.drains >= 2) runs.push(r);
}
writeFileSync("scripts/fixtures/pinball-v8.json", JSON.stringify({ gameVersion: "8.0.0", runs }));
console.log(runs.map((r) => `${r.status}/${r.failure} score ${r.score} drains ${r.drains} tick ${r.finalTick} inputs ${r.inputs.length}`).join("\n"));
