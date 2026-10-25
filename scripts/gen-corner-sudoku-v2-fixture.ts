import { writeFileSync } from "node:fs";
import { sha256 } from "../lib/server/matchIntegrity";
import { canonicalJson } from "../lib/verified/canonical";
import { generateScenario } from "../lib/server/scenarios";
import { playCornerSudokuV2 } from "./corner-sudoku-v2-play-fixture";
function run(i: number, opts: Parameters<typeof playCornerSudokuV2>[1]) {
  const seed = generateScenario({ game_id: "corner-sudoku", game_version: "2.0.0" }, i).seed;
  const { s, inputs } = playCornerSudokuV2(seed, opts);
  return { seed, finalTick: s.tick, score: s.score, status: s.status, failure: s.failure, hash: sha256(canonicalJson(s)), inputs: inputs.map((x) => [x.tick, x.action]) };
}
const runs = [run(0, { delay: 50 }), run(1, { delay: 90, wrongEvery: 9 }), run(2, { delay: 30, wrongEvery: 2 })];
writeFileSync("scripts/fixtures/corner-sudoku-v2.json", JSON.stringify({ gameVersion: "2.0.0", runs }));
console.log(runs.map((r) => `${r.status}/${r.failure} score ${r.score} tick ${r.finalTick} inputs ${r.inputs.length}`).join("\n"));
