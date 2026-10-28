import assert from "node:assert/strict";
import { generateScenario } from "../lib/server/scenarios";
import { applyCoreInput, replayCore, stepCore } from "../lib/verified/coreRuntime.v1";
import {
  CORNER_SUDOKU_CELL_POS_V4 as POS,
  CORNER_SUDOKU_CORE_V4 as core,
  CORNER_SUDOKU_PEERS_V4 as PEERS,
  CORNER_SUDOKU_RULES_V4 as R,
  cornerSudokuConflictsV4,
} from "../lib/verified/cornerSudokuCore.v4";
import { countCornerSudokuSolutionsV3 } from "../lib/verified/cornerSudokuCore.v3";
import { CORNER_SUDOKU_ACTIONS_V3 } from "../lib/verified/cornerSudokuProtocol.v3";
import { verifyCoreFixture } from "./core-test-utils";
import { playCornerSudokuV4 } from "./corner-sudoku-v4-play-fixture";
import fixture from "./fixtures/corner-sudoku-v4.json" with { type: "json" };

assert.equal(core.gameVersion, "4.0.0");
assert.equal(CORNER_SUDOKU_ACTIONS_V3.length, 45 * 9 + 45, "PUT for every digit plus CLR for every cell");

// Generation: TWO valid, unique, reproducible puzzles, the second with fewer givens.
const firsts = new Set<string>();
const givenTotals = [0, 0];
for (let i = 0; i < 40; i++) {
  const seed: string = generateScenario({ game_id: core.gameId, game_version: core.gameVersion }, i).seed;
  const a = core.create(seed);
  assert.deepEqual(a, core.create(seed));
  assert.equal(a.puzzles.length, 2, "two puzzles per match");
  a.puzzles.forEach((p, n) => {
    p.solution.forEach((d, c) => PEERS[c].forEach((q) => assert.notEqual(p.solution[q], d, "no peer repeats")));
    for (let k = 0; k < 3; k++) {
      const row = POS.flatMap((q, c) => (q.row === k ? [p.solution[c]] : []));
      assert.deepEqual([...row].sort(), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    }
    p.givens.forEach((d, c) => assert.ok(d === 0 || d === p.solution[c]));
    assert.equal(countCornerSudokuSolutionsV3([...p.givens], 2), 1, "unique solution");
    givenTotals[n] += p.givens.filter(Boolean).length;
  });
  firsts.add(a.puzzles[0].givens.join(""));
}
assert.equal(firsts.size, 40, "every scenario differs");
assert.ok(givenTotals[1] < givenTotals[0], `fewer givens in the second puzzle (${givenTotals.map((t) => t / 40).join(", ")})`);

// Free entry: write anything, overwrite, erase; givens are locked; nothing is checked until the board is complete.
{
  const s = core.create("cs4-rules");
  const sol = s.puzzles[0].solution, given = s.board.findIndex(Boolean), empty = s.board.findIndex((d) => d === 0);
  assert.equal(core.canApply(s, `PUT_${given}_${(s.board[given] % 9) + 1}`), false, "givens cannot be overwritten");
  assert.equal(core.canApply(s, `CLR_${given}`), false, "givens cannot be erased");
  assert.equal(core.canApply(s, `CLR_${empty}`), false, "nothing to erase");
  const wrong = (sol[empty] % 9) + 1;
  assert.ok(applyCoreInput(core, s, `PUT_${empty}_${wrong}`, 1e9));
  assert.equal(s.board[empty], wrong, "a wrong digit stays on the board");
  assert.equal(s.score, 0, "no score feedback while playing (the solution is never revealed)");
  assert.equal(core.canApply(s, `PUT_${empty}_${wrong}`), false, "same digit again is a no-op");
  assert.ok(applyCoreInput(core, s, `CLR_${empty}`, 1e9));
  assert.equal(s.board[empty], 0, "erased");
  // Fill everything right except one cell → not solved; fix it → solved.
  const blanks = s.board.flatMap((d, i) => (d === 0 ? [i] : []));
  for (const c of blanks.slice(1)) applyCoreInput(core, s, `PUT_${c}_${sol[c]}`, 1e9);
  applyCoreInput(core, s, `PUT_${blanks[0]}_${(sol[blanks[0]] % 9) + 1}`, 1e9);
  assert.ok(s.board.every(Boolean));
  assert.equal(s.phase, "play", "a full but wrong board is not solved");
  assert.ok(cornerSudokuConflictsV4(s.board).some(Boolean), "the wrong digit conflicts with a peer");
  applyCoreInput(core, s, `PUT_${blanks[0]}_${sol[blanks[0]]}`, 1e9);
  assert.equal(s.phase, "clear");
  assert.equal(s.solved, 1);
  assert.ok(s.score >= R.solveBonus, "solve bonus");
  assert.equal(core.canApply(s, `CLR_${blanks[0]}`), false, "no input during the clear animation");
}
// Clean fast run wins both; slower scores less; idle times out with 0; a partial run scores its correct cells only.
const fast = playCornerSudokuV4("cs4-fast", { delay: 40 }), slow = playCornerSudokuV4("cs4-fast", { delay: 110 });
assert.equal(fast.s.status, "won");
assert.equal(fast.s.solved, 2);
assert.ok(fast.s.score > slow.s.score, "faster solving scores more");
const idle = playCornerSudokuV4("cs4-idle", { idle: true });
assert.equal(idle.s.failure, "TIME_LIMIT");
assert.equal(idle.s.tick, R.maxFinalTick);
assert.equal(idle.s.score, 0);
const partial = playCornerSudokuV4("cs4-partial", { delay: 60, wrongEvery: 4, stopAfter: 8 });
assert.equal(partial.s.failure, "TIME_LIMIT");
{
  const p = partial.s.puzzles[partial.s.current];
  const correct = partial.s.board.filter((d, i) => p.givens[i] === 0 && d !== 0 && d === p.solution[i]).length;
  assert.ok(correct > 0 && partial.s.board.some((d, i) => d !== 0 && d !== p.solution[i]), "partial run has right and wrong digits");
  assert.equal(partial.s.solved, 0);
  assert.equal(partial.s.score, correct * R.partialPoints, "time limit: only correctly filled cells score");
}
for (const run of [fast, slow, partial, playCornerSudokuV4("cs4-mixed", { delay: 70, wrongEvery: 5, erase: true })]) {
  const replay = replayCore(core, run.inputs, run.s.tick, run.s.seed, 1e9);
  assert.equal(replay.valid, true, String(replay.error));
  assert.deepEqual(replay.state, run.s);
}
for (const r of fixture.runs as any[])
  verifyCoreFixture(core, r.seed, r.inputs.map(([tick, action]: (string | number)[], seq: number) => ({ seq, tick: Number(tick), action: String(action) })), r.finalTick, 1e9, {
    score: r.score, status: r.status, failure: r.failure, hash: r.hash,
  });
console.log(`Galoku V4 OK · 2 unique puzzles · free entry with overwrite/erase · solved only when the board matches · partial credit at time limit · fast ${fast.s.score} slow ${slow.s.score} partial ${partial.s.score}`);
