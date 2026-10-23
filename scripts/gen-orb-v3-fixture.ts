import { writeFileSync } from "node:fs";
import { sha256 } from "../lib/server/matchIntegrity";
import { canonicalJson } from "../lib/verified/canonical";
import { playOrbV3 } from "./orb-v3-play-fixture";
const runs = ["orb3-golden-a", "orb3-golden-b"].map((seed) => {
  const { s, inputs } = playOrbV3(seed, 400, true);
  return { seed, finalTick: s.tick, score: s.score, status: s.status, failure: s.failure, hash: sha256(canonicalJson(s)), inputs: inputs.map((i) => [i.tick, i.action]) };
});
writeFileSync("scripts/fixtures/orb-v3.json", JSON.stringify({ gameVersion: "3.0.0", runs }, null, 1));
console.log(runs.map((r) => `${r.seed} h${r.score} ${r.status} t${r.finalTick} in${r.inputs.length}`).join("\n"));
