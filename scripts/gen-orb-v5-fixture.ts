import { writeFileSync } from "node:fs";
import { sha256 } from "../lib/server/matchIntegrity";
import { canonicalJson } from "../lib/verified/canonical";
import { playOrbV5 } from "./orb-v5-play-fixture";
const runs = ["orb5-golden-a", "orb5-golden-b"].map((seed) => {
  const { s, inputs } = playOrbV5(seed, 400, true);
  return { seed, finalTick: s.tick, score: s.score, status: s.status, failure: s.failure, hash: sha256(canonicalJson(s)), inputs: inputs.map((i) => [i.tick, i.action]) };
});
writeFileSync("scripts/fixtures/orb-v5.json", JSON.stringify({ gameVersion: "5.0.0", runs }, null, 1));
console.log(runs.map((r) => `${r.seed} h${r.score} ${r.status} t${r.finalTick} in${r.inputs.length}`).join("\n"));
