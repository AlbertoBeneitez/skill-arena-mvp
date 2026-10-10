import assert from "node:assert/strict";
import {
  MINE_GRID_CORE_V2 as core,
  projectMineV2,
} from "../lib/verified/mineGridCore.v2";
import { isMineBoardSolvable } from "../lib/verified/mineGridCore.v1";
import { nextMineAction } from "./mine-play-fixture";
import {
  applyCoreInput,
  stepCore,
  replayCore,
} from "../lib/verified/coreRuntime.v1";
import type { ReplayInput } from "../lib/verified/inputValidation";
import { verifyCoreFixture } from "./core-test-utils";
import fixture from "./fixtures/mine-v2.json" with { type: "json" };
verifyCoreFixture(core, fixture.seed, fixture.inputs, fixture.finalTick, 1e9, {
  score: 8379,
  status: "won",
  failure: null,
  hash: "sha256:0e1895de3ca66b2e042b27e35335db262bbc9ff81f3f86d097bae184b85262b4",
});
const boards = new Set<string>();
for (let n = 0; n < 1000; n++) {
  const s = core.create(`mine-v2-private-sample-${n}`),
    board = JSON.stringify(s.board);
  assert.ok(isMineBoardSolvable(s.board));
  assert.deepEqual(core.create(s.seed).board, s.board);
  boards.add(board);
  assert.equal(s.board.values[s.board.startIndex], 0);
  const v = projectMineV2(s);
  assert.ok(v.cells.every((c) => c === null));
  assert.equal("stage" in v, false);
  assert.equal("levels" in v, false);
  assert.equal("seed" in v, false);
  assert.equal("values" in v, false);
  if (n < 64) {
    const inputs: ReplayInput[] = [];
    while (s.status === "running") {
      const action = nextMineAction(s);
      inputs.push({ seq: inputs.length, tick: s.tick, action });
      assert.equal(applyCoreInput(core, s, action, 1e9), true);
      assert.equal(JSON.stringify(s.board), board, "no board replacement");
      if (s.status === "running") stepCore(core, s, 1e9);
    }
    assert.equal(s.status, "won");
    assert.equal(s.height, 66);
    assert.deepEqual(replayCore(core, inputs, s.tick, s.seed, 1e9).state, s);
  }
}
assert.equal(boards.size, 1000, "1000 distinct solvable private setups");
console.log(
  "Mine V2: 1000 distinct reproducible no-guess fields, 64 full continuous replays, no hidden state or levels in projection",
);

const invalid = core.create("invalid");
assert.equal(applyCoreInput(core, invalid, "OPEN_000", 1e9), false);
assert.equal(applyCoreInput(core, invalid, "FLAG_000", 1e9), false);
assert.equal(
  applyCoreInput(
    core,
    invalid,
    `OPEN_${String(invalid.board.startIndex).padStart(3, "0")}`,
    1e9,
  ),
  true,
);
const hidden = invalid.revealed.findIndex((v) => !v);
const mark = `FLAG_${String(hidden).padStart(3, "0")}`,
  open = `OPEN_${String(hidden).padStart(3, "0")}`,
  score = invalid.score;
assert.equal(applyCoreInput(core, invalid, mark, 1e9), true);
assert.equal(invalid.score, score);
assert.equal(applyCoreInput(core, invalid, open, 1e9), false);
assert.equal(applyCoreInput(core, invalid, mark, 1e9), true);
const mines = invalid.board.values.flatMap((v, i) => (v === -1 ? [i] : []));
for (const index of mines.slice(0, 2))
  applyCoreInput(core, invalid, `OPEN_${String(index).padStart(3, "0")}`, 1e9);
assert.equal(invalid.status, "failed");
assert.equal(invalid.failure, "MINES");
// Reuse the shared private authority: both participants get the same initial field,
// independent append-only command records and no hidden projection.
const { HiddenCommandAuthority } = await import(
  "../lib/server/hiddenCommandAuthority"
);
const { MemoryMatchRepository } = await import(
  "../lib/server/demo/memoryMatchRepository"
);
const { MemoryCommandAttemptRepository } = await import(
  "../lib/server/demo/memoryCommandAttemptRepository"
);
const { createPrivateMatchManifest } = await import(
  "../lib/server/privateMatchIssuer"
);
const { hashManifest } = await import("../lib/server/matchIntegrity");
const matches = new MemoryMatchRepository(),
  attempts = new MemoryCommandAttemptRepository();
const manifest = createPrivateMatchManifest("mine-grid", "2.0.0");
await matches.createMatch(manifest, {
  A: "private-local-a",
  B: "private-local-b",
});
for (const [attemptId, playerId] of [
  ["candidate-a", "private-local-a"],
  ["candidate-b", "private-local-b"],
])
  await attempts.create({
    attemptId,
    playerId,
    matchId: manifest.match_id,
    manifestHash: hashManifest(manifest),
    revision: 0,
    inputs: [],
    commands: [],
    terminal: false,
  });
const authority = new HiddenCommandAuthority(
  matches,
  attempts,
  { core, project: projectMineV2 },
  "demo",
);
const initial = await authority.read("candidate-a", "private-local-a");
const openFirst = `OPEN_${String(initial.view.startIndex).padStart(3, "0")}`;
const a = await authority.command(
  {
    attemptId: "candidate-a",
    commandId: "first-a",
    expectedRevision: 0,
    action: openFirst,
  },
  "private-local-a",
);
const b = await authority.command(
  {
    attemptId: "candidate-b",
    commandId: "first-b",
    expectedRevision: 0,
    action: openFirst,
  },
  "private-local-b",
);
assert.deepEqual(a.view, b.view);
assert.equal(a.matchId, b.matchId);
assert.equal(JSON.stringify(a).includes(manifest.seed), false);
assert.deepEqual(
  await authority.command(
    {
      attemptId: "candidate-a",
      commandId: "first-a",
      expectedRevision: 0,
      action: openFirst,
    },
    "private-local-a",
  ),
  a,
);
await assert.rejects(
  () => authority.read("candidate-a", "unrelated"),
  (e) => (e as { code: string }).code === "NOT_FOUND",
);
const stored = await attempts.findForPlayer("candidate-a", "private-local-a");
assert.equal(stored?.inputs.length, 1);
console.log(
  "Mine V2 private authority: shared setup, independent records, idempotency, membership and no seed disclosure",
);
