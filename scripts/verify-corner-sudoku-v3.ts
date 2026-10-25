import assert from "node:assert/strict";
import { generateScenario } from "../lib/server/scenarios";
import { applyCoreInput, replayCore, stepCore } from "../lib/verified/coreRuntime.v1";
import {
  CORNER_SUDOKU_CELL_POS_V3 as POS,
  CORNER_SUDOKU_CORE_V3 as core,
  CORNER_SUDOKU_PEERS_V3 as PEERS,
  CORNER_SUDOKU_RULES_V3 as R,
  countCornerSudokuSolutionsV3,
} from "../lib/verified/cornerSudokuCore.v3";
import { CORNER_SUDOKU_ACTIONS_V1 } from "../lib/verified/cornerSudokuProtocol.v1";
import { verifyCoreFixture } from "./core-test-utils";
import { playCornerSudokuV3 } from "./corner-sudoku-v3-play-fixture";
import fixture from "./fixtures/corner-sudoku-v3.json" with { type: "json" };

assert.equal(CORNER_SUDOKU_ACTIONS_V1.length, 45 * 9);
// Peers: 8 in the box, plus 6 along the top row (A, B, D) and/or 6 down the left column (A, C, E).
assert.equal(PEERS[0].length, 8 + 6 + 6, "corner cell: box + its full row + its full column");
assert.equal(PEERS[9].length, 8 + 6, "top band: box + its full row");
assert.equal(PEERS[27].length, 8 + 6, "left stack: box + its full column");

// Generation: valid, unique, reproducible, progressively fewer givens, varied.
const firsts = new Set<string>();
let givenTotals = [0, 0, 0];
for (let i = 0; i < 60; i++) {
  const seed = generateScenario({ game_id: core.gameId, game_version: core.gameVersion }, i).seed;
  const a = core.create(seed);
  assert.deepEqual(a, core.create(seed));
  assert.equal(a.puzzles.length, 3, "three puzzles per match");
  a.puzzles.forEach((p, n) => {
    for (let b = 0; b < 5; b++) assert.deepEqual([...p.solution.slice(b * 9, b * 9 + 9)].sort(), [1, 2, 3, 4, 5, 6, 7, 8, 9], "each box holds 1–9");
    p.solution.forEach((d, c) => PEERS[c].forEach((q) => assert.notEqual(p.solution[q], d, "no peer repeats")));
    for (let k = 0; k < 3; k++) {
      const row = POS.flatMap((q, c) => (q.row === k ? [p.solution[c]] : [])), col = POS.flatMap((q, c) => (q.col === k ? [p.solution[c]] : []));
      assert.deepEqual([...row].sort(), [1, 2, 3, 4, 5, 6, 7, 8, 9], "top rows hold 1–9");
      assert.deepEqual([...col].sort(), [1, 2, 3, 4, 5, 6, 7, 8, 9], "left columns hold 1–9");
    }
    p.givens.forEach((d, c) => assert.ok(d === 0 || d === p.solution[c]));
    assert.equal(countCornerSudokuSolutionsV3([...p.givens], 2), 1, "unique solution");
    givenTotals[n] += p.givens.filter(Boolean).length;
  });
  firsts.add(a.puzzles[0].givens.join(""));
}
assert.ok(firsts.size === 60, "every scenario differs");
givenTotals = givenTotals.map((t) => t / 60);
for (let n = 1; n < 3; n++) assert.ok(givenTotals[n] <= givenTotals[n - 1] + 0.01, `fewer givens later (${givenTotals.join(", ")})`);
assert.ok(givenTotals[0] >= 31 && givenTotals[2] < givenTotals[0] && givenTotals[2] <= 28, `givens ${givenTotals.join(", ")}`);

// Rules: givens cannot be overwritten; a wrong digit is rejected and penalised; five mistakes end the match.
{
  const s = core.create("cs-rules");
  const given = s.board.findIndex(Boolean), empty = s.board.findIndex((d) => d === 0);
  assert.equal(core.canApply(s, `PUT_${given}_${s.board[given]}`), false);
  const right = s.puzzles[0].solution[empty];
  applyCoreInput(core, s, `PUT_${empty}_${right}`, 1e9);
  assert.equal(s.board[empty], right);
  assert.equal(s.score, R.correctPoints);
  assert.equal(core.canApply(s, `PUT_${empty}_${right}`), false, "a solved cell is locked");
  const next = s.board.findIndex((d) => d === 0), wrong = (s.puzzles[0].solution[next] % 9) + 1;
  for (let k = 0; k < R.maxMistakes; k++) { applyCoreInput(core, s, `PUT_${next}_${wrong}`, 1e9); stepCore(core, s, 1e9); }
  assert.equal(s.board[next], 0);
  assert.equal(s.status, "failed");
  assert.equal(s.failure, "MISTAKES");
  assert.equal(s.score, 0);
}
// A full clean run solves all five, faster scores more; idle runs out of time.
const fast = playCornerSudokuV3("cs-fast", { delay: 40 }), slow = playCornerSudokuV3("cs-fast", { delay: 110 });
assert.equal(fast.s.status, "won");
assert.equal(fast.s.solved, 3);
assert.ok(fast.s.score > slow.s.score, "faster solving scores more");
const idle = playCornerSudokuV3("cs-idle", { idle: true });
assert.equal(idle.s.status, "failed");
assert.equal(idle.s.failure, "TIME_LIMIT");
assert.equal(idle.s.tick, R.maxFinalTick);
for (const run of [fast, slow, playCornerSudokuV3("cs-mixed", { delay: 70, wrongEvery: 7 })]) {
  const replay = replayCore(core, run.inputs, run.s.tick, run.s.seed, 1e9);
  assert.equal(replay.valid, true, String(replay.error));
  assert.deepEqual(replay.state, run.s);
}
for (const r of fixture.runs as any[])
  verifyCoreFixture(core, r.seed, r.inputs.map(([tick, action]: (string | number)[], seq: number) => ({ seq, tick: Number(tick), action: String(action) })), r.finalTick, 1e9, {
    score: r.score, status: r.status, failure: r.failure, hash: r.hash,
  });
console.log(`Galoku (Corner Sudoku V3) OK · 60 scenarios × 3 unique puzzles · 5 boxes · givens ${givenTotals.map((g) => g.toFixed(1)).join("/")} · fast ${fast.s.score} slow ${slow.s.score}`);
