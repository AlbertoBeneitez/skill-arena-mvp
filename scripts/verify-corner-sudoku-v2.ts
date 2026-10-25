import assert from "node:assert/strict";
import { generateScenario } from "../lib/server/scenarios";
import { applyCoreInput, replayCore, stepCore } from "../lib/verified/coreRuntime.v1";
import {
  CORNER_SUDOKU_CELL_POS_V2 as POS,
  CORNER_SUDOKU_CORE_V2 as core,
  CORNER_SUDOKU_PEERS_V2 as PEERS,
  CORNER_SUDOKU_RULES_V2 as R,
  countCornerSudokuSolutionsV2,
  cornerSudokuDigitOkV2,
} from "../lib/verified/cornerSudokuCore.v2";
import { CORNER_SUDOKU_ACTIONS_V2 } from "../lib/verified/cornerSudokuProtocol.v2";
import { verifyCoreFixture } from "./core-test-utils";
import { playCornerSudokuV2 } from "./corner-sudoku-v2-play-fixture";
import fixture from "./fixtures/corner-sudoku-v2.json" with { type: "json" };

assert.equal(CORNER_SUDOKU_ACTIONS_V2.length, 27 * 9);
// Three boxes: the corner A, B to its right, C below. Peers: 8 in the box plus 3 along the row (A–B) and/or 3 down the column (A–C).
assert.equal(POS.length, 27);
assert.equal(PEERS[0].length, 8 + 3 + 3, "corner cell: box + row in B + column in C");
assert.equal(PEERS[9].length, 8 + 3, "box B: box + its row in A");
assert.equal(PEERS[18].length, 8 + 3, "box C: box + its column in A");

// Generation: valid, unique, reproducible, progressively fewer givens, varied.
const firsts = new Set<string>();
let givenTotals = [0, 0, 0, 0, 0];
for (let i = 0; i < 60; i++) {
  const seed = generateScenario({ game_id: core.gameId, game_version: core.gameVersion }, i).seed;
  const a = core.create(seed);
  assert.deepEqual(a, core.create(seed));
  assert.equal(a.puzzles.length, 5);
  a.puzzles.forEach((p, n) => {
    for (let b = 0; b < 3; b++) assert.deepEqual([...p.solution.slice(b * 9, b * 9 + 9)].sort(), [1, 2, 3, 4, 5, 6, 7, 8, 9], "each box holds 1–9");
    p.solution.forEach((d, c) => PEERS[c].forEach((q) => assert.notEqual(p.solution[q], d, "no peer repeats")));
    for (let k = 0; k < 3; k++) {
      const row = POS.flatMap((q, c) => (q.row === k ? [p.solution[c]] : [])), col = POS.flatMap((q, c) => (q.col === k ? [p.solution[c]] : []));
      assert.equal(row.length, 6); assert.equal(new Set(row).size, 6, "no repeats along a top row");
      assert.equal(col.length, 6); assert.equal(new Set(col).size, 6, "no repeats down a left column");
    }
    p.givens.forEach((d, c) => assert.ok(d === 0 || d === p.solution[c]));
    assert.ok(countCornerSudokuSolutionsV2([...p.givens], 1) === 1, "solvable");
    assert.equal(p.givens.filter(Boolean).length, R.givens[n], "carved to the target count");
    givenTotals[n] += p.givens.filter(Boolean).length;
  });
  firsts.add(a.puzzles[0].givens.join(""));
}
assert.ok(firsts.size === 60, "every scenario differs");
givenTotals = givenTotals.map((t) => t / 60);
for (let n = 1; n < 5; n++) assert.ok(givenTotals[n] < givenTotals[n - 1], `fewer givens later (${givenTotals.join(", ")})`);
assert.deepEqual(givenTotals, [12, 11, 10, 9, 8]);
// Any completable digit is accepted: on an open board there are cells with several correct digits, and a repeat is never accepted.
{
  const s = core.create("cs-alt");
  let alternatives = 0;
  for (let c = 0; c < 27; c++) {
    if (s.board[c]) continue;
    const ok = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => cornerSudokuDigitOkV2(s.board, c, d));
    assert.ok(ok.includes(s.puzzles[0].solution[c]), "the seeded solution digit is always accepted");
    for (const d of ok) for (const q of PEERS[c]) assert.notEqual(s.board[q], d);
    if (ok.length > 1) alternatives++;
  }
  assert.ok(alternatives > 3, "several cells accept more than one digit");
  const c = s.board.findIndex((d) => d === 0), alt = [1, 2, 3, 4, 5, 6, 7, 8, 9].find((d) => d !== s.puzzles[0].solution[c] && cornerSudokuDigitOkV2(s.board, c, d));
  if (alt) { applyCoreInput(core, s, `PUT_${c}_${alt}`, 1e9); assert.equal(s.board[c], alt, "an alternative valid digit is accepted"); assert.equal(s.mistakes, 0); }
}

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
  const next = s.board.findIndex((d) => d === 0), wrong = [1, 2, 3, 4, 5, 6, 7, 8, 9].find((d) => !cornerSudokuDigitOkV2(s.board, next, d))!;
  for (let k = 0; k < R.maxMistakes; k++) { applyCoreInput(core, s, `PUT_${next}_${wrong}`, 1e9); stepCore(core, s, 1e9); }
  assert.equal(s.board[next], 0);
  assert.equal(s.status, "failed");
  assert.equal(s.failure, "MISTAKES");
  assert.equal(s.score, 0);
}
// A full clean run solves all five, faster scores more; idle runs out of time.
const fast = playCornerSudokuV2("cs-fast", { delay: 40 }), slow = playCornerSudokuV2("cs-fast", { delay: 110 });
assert.equal(fast.s.status, "won");
assert.equal(fast.s.solved, 5);
assert.ok(fast.s.score > slow.s.score, "faster solving scores more");
const idle = playCornerSudokuV2("cs-idle", { idle: true });
assert.equal(idle.s.status, "failed");
assert.equal(idle.s.failure, "TIME_LIMIT");
assert.equal(idle.s.tick, R.maxFinalTick);
for (const run of [fast, slow, playCornerSudokuV2("cs-mixed", { delay: 70, wrongEvery: 7 })]) {
  const replay = replayCore(core, run.inputs, run.s.tick, run.s.seed, 1e9);
  assert.equal(replay.valid, true, String(replay.error));
  assert.deepEqual(replay.state, run.s);
}
for (const r of fixture.runs as any[])
  verifyCoreFixture(core, r.seed, r.inputs.map(([tick, action]: (string | number)[], seq: number) => ({ seq, tick: Number(tick), action: String(action) })), r.finalTick, 1e9, {
    score: r.score, status: r.status, failure: r.failure, hash: r.hash,
  });
console.log(`Galakdoku (Corner Sudoku V2) OK · 60 scenarios × 5 puzzles · givens ${givenTotals.map((g) => g.toFixed(1)).join("/")} · fast ${fast.s.score} slow ${slow.s.score}`);
