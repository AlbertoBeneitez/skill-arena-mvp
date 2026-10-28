import { writeFileSync } from "node:fs";
import { sha256 } from "../lib/server/matchIntegrity";
import { canonicalJson } from "../lib/verified/canonical";
import { generateScenario } from "../lib/server/scenarios";
import { playCornerSudokuV4 } from "./corner-sudoku-v4-play-fixture";
function run(i: number, opts: Parameters<typeof playCornerSudokuV4>[1]) {
  const seed = generateScenario({ game_id: "corner-sudoku", game_version: "4.0.0" }, i).seed;
  const { s, inputs } = playCornerSudokuV4(seed, opts);
  return { seed, finalTick: s.tick, score: s.score, status: s.status, failure: s.failure, hash: sha256(canonicalJson(s)), inputs: inputs.map((x) => [x.tick, x.action]) };
}
const runs = [run(0, { delay: 50 }), run(1, { delay: 90, wrongEvery: 6, erase: true }), run(2, { delay: 120, wrongEvery: 4, stopAfter: 30 })];
writeFileSync("scripts/fixtures/corner-sudoku-v4.json", JSON.stringify({ gameVersion: "4.0.0", runs }));
console.log(runs.map((r) => `${r.status}/${r.failure} score ${r.score} tick ${r.finalTick} inputs ${r.inputs.length}`).join("\n"));
