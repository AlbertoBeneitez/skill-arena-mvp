import { writeFileSync } from "node:fs";
import { sha256 } from "../lib/server/matchIntegrity";
import { canonicalJson } from "../lib/verified/canonical";
import { generateScenario } from "../lib/server/scenarios";
import { playBilliardsV7 } from "./billiards-v7-play-fixture";
const runs = [0, 1].map((i) => {
  const seed = generateScenario({ game_id: "billiards", game_version: "7.0.0" }, i).seed;
  const { s, inputs } = playBilliardsV7(seed);
  return { seed, finalTick: s.tick, score: s.score, status: s.status, failure: s.failure, hash: sha256(canonicalJson(s)), inputs: inputs.map((x) => [x.tick, x.action]) };
});
writeFileSync("scripts/fixtures/billiards-v7.json", JSON.stringify({ gameVersion: "7.0.0", runs }));
console.log(runs.map((r) => `${r.status}/${r.failure} score ${r.score} tick ${r.finalTick} inputs ${r.inputs.length}`).join("\n"));
