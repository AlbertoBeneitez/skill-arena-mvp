import { writeFileSync } from "node:fs";
import { sha256 } from "../lib/server/matchIntegrity";
import { canonicalJson } from "../lib/verified/canonical";
import { generateScenario } from "../lib/server/scenarios";
import { playPinball } from "./pinball-play-fixture";
const runs = [0, 7].map((i, n) => {
  const seed = generateScenario({ game_id: "pinball", game_version: "1.0.0" }, i).seed;
  const { s, inputs } = playPinball(seed, "smart", 5 + n);
  return { seed, finalTick: s.tick, score: s.score, status: s.status, failure: s.failure, hash: sha256(canonicalJson(s)), inputs: inputs.map((x) => [x.tick, x.action]) };
});
writeFileSync("scripts/fixtures/pinball-v1.json", JSON.stringify({ gameVersion: "1.0.0", runs }));
console.log(runs.map((r) => `${r.status}/${r.failure} score ${r.score} tick ${r.finalTick} inputs ${r.inputs.length}`).join("\n"));
