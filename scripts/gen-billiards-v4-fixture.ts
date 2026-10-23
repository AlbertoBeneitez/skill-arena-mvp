import { writeFileSync } from "node:fs";
import { sha256 } from "../lib/server/matchIntegrity";
import { canonicalJson } from "../lib/verified/canonical";
import { generateScenario } from "../lib/server/scenarios";
import { playBilliardsV4 } from "./billiards-v4-play-fixture";
const runs = [0, 1].map((i) => {
  const seed = generateScenario({ game_id: "billiards", game_version: "4.0.0" }, i + 7).seed, { state: s, inputs } = playBilliardsV4(seed);
  return { seed, finalTick: s.tick, score: s.score, status: s.status, failure: s.failure, hash: sha256(canonicalJson(s)), inputs };
});
writeFileSync("scripts/fixtures/billiards-v4.json", JSON.stringify({ gameVersion: "4.0.0", runs }, null, 1));
console.log(runs.map((r) => `${r.score} ${r.status} ${r.finalTick} ${r.inputs.length}`).join("\n"));
