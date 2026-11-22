import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { replayCore } from "../lib/verified/coreRuntime.v1";
import {
  SOLITAIRE_CORE_V1,
  canApplySolitaireV1,
  createSolitaireV1,
  projectSolitaireV1,
  type SolitaireStateV1,
} from "../lib/verified/solitaireCore.v1.server";
import { SOLITAIRE_ACTIONS_V1 } from "../lib/verified/solitaireProtocol.v1";
import { solveKlondike, type SolverMove } from "../lib/solitaireSolver";
import {
  createSolitaireMatchManifest,
  isSolvableSolitaireSeed,
  solitaireDeckFromSeed,
} from "../lib/server/solitaireDeals";
import { getServerGameAdapter } from "../lib/server/gameVerifiers";
import type { MatchManifestV3 } from "../lib/verified/contracts";

const core = SOLITAIRE_CORE_V1;
const sha = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

// 1 · Deal and projection: same seed, same deal; the phone never sees a face-down id, the stock or the seed.
const seed = "solitaire-v1-test-0";
assert.deepEqual(createSolitaireV1(seed), createSolitaireV1(seed));
assert.notDeepEqual(createSolitaireV1(seed).columns, createSolitaireV1("solitaire-v1-test-1").columns);
function checkProjection(s: SolitaireStateV1) {
  const view = projectSolitaireV1(s);
  const text = JSON.stringify(view);
  assert.ok(!text.includes(seed));
  view.tableau.forEach((column, i) => {
    const hidden = s.columns[i].length - s.up[i];
    assert.equal(column.filter((card) => card === null).length, hidden);
    assert.deepEqual(column.slice(hidden), s.columns[i].slice(hidden));
  });
  assert.equal(view.stockCount, s.stock.length);
  assert.equal(view.wasteTop, s.waste.at(-1) ?? null);
  const visible = new Set([...view.tableau.flat().filter((c): c is number => c !== null), ...(view.wasteTop === null ? [] : [view.wasteTop])]);
  for (const card of s.stock) assert.ok(!visible.has(card));
}
const fresh = createSolitaireV1(seed);
checkProjection(fresh);
assert.deepEqual(fresh.up, [1, 1, 1, 1, 1, 1, 1]);
assert.equal(fresh.stock.length, 24);
assert.deepEqual([...fresh.columns.flat(), ...fresh.stock].sort((a, b) => a - b), Array.from({ length: 52 }, (_, i) => i));

// 2 · Rules: nothing illegal is accepted.
assert.equal(canApplySolitaireV1(fresh, "W>F"), false, "empty waste");
assert.equal(canApplySolitaireV1(fresh, "W>T0"), false, "empty waste");
assert.equal(canApplySolitaireV1(fresh, "T0>T0"), false, "same column");
assert.equal(canApplySolitaireV1(fresh, "T7>F"), false, "no column 7");
assert.equal(canApplySolitaireV1(fresh, "DRAW"), true);
assert.ok(SOLITAIRE_ACTIONS_V1.length === 1 + 1 + 7 + 7 + 42 + 1);
const drained = createSolitaireV1(seed);
drained.stock = [];
drained.waste = [];
assert.equal(canApplySolitaireV1(drained, "DRAW"), false, "nothing to draw or redeal");

// 3 · A solver solution, played as commands (one per tick, as the hidden authority stores them), wins the deal.
function toActions(deckSeed: string, solution: readonly SolverMove[]) {
  const s = createSolitaireV1(deckSeed);
  const actions: string[] = [];
  const play = (action: string) => {
    assert.ok(canApplySolitaireV1(s, action), `${action} must be legal`);
    core.apply(s, action);
    actions.push(action);
  };
  for (const m of solution) {
    if (s.status !== "running") break;
    if (m.from === "talon") {
      let guard = 0;
      while (s.waste.at(-1) !== m.card) {
        assert.ok(++guard < 200);
        play("DRAW");
      }
      play(m.kind === "foundation" ? "W>F" : `W>T${m.to}`);
    } else if (m.kind === "foundation") play(`T${m.from}>F`);
    else {
      const moved = s.columns[m.from].length;
      play(`T${m.from}>T${m.to}`);
      assert.equal(moved - s.columns[m.from].length, m.count, "the implied run is the solver's run");
    }
    checkProjection(s);
  }
  return { actions, state: s };
}
let solvedSeed = "";
for (let i = 0; !solvedSeed; i++) {
  assert.ok(i < 40, "a winnable test deal exists");
  if (isSolvableSolitaireSeed(`solitaire-v1-test-${i}`)) solvedSeed = `solitaire-v1-test-${i}`;
}
const solution = solveKlondike(solitaireDeckFromSeed(solvedSeed), 250_000);
const played = toActions(solvedSeed, solution.moves);
assert.equal(played.state.status, "won");
assert.equal(played.state.score, 52);
assert.ok(played.state.columns.every((c, i) => played.state.up[i] === c.length), "won when every tableau card is face up");
const inputs = played.actions.map((action, i) => ({ seq: i, tick: i, action }));
const replay = replayCore(core, inputs, inputs.length - 1, solvedSeed, 1e9);
assert.equal(replay.valid, true, replay.error ?? "");
assert.equal(replay.won, true);
assert.equal(replay.score, 52);
const golden = sha({ seed: solvedSeed, actions: played.actions, view: projectSolitaireV1(replay.state) });
assert.equal(golden, "457e0d4fdf325e076b90b9aab537d2f33e1469ba7ca262bc1425105d212986d9", "frozen V1 replay");

// 4 · An illegal command is rejected by the replay; TIME_UP closes the attempt as unsolved.
const bad = replayCore(core, [{ seq: 0, tick: 0, action: "W>F" }], 0, solvedSeed, 1e9);
assert.equal(bad.valid, false);
assert.equal(bad.error, "ACTION_NOT_AVAILABLE");
const resigned = replayCore(core, [{ seq: 0, tick: 0, action: "DRAW" }, { seq: 1, tick: 1, action: "TIME_UP" }], 1, solvedSeed, 1e9);
assert.equal(resigned.valid, true);
assert.equal(resigned.won, false);
assert.equal(resigned.failure, "TIME_UP");

// 5 · The issuer hands out only solver-proven winnable deals.
const seeds = Array.from({ length: 12 }, (_, i) => `solitaire-v1-issuer-${i}`);
const solvable = new Map(seeds.map((s) => [s, isSolvableSolitaireSeed(s)]));
const firstSolvable = seeds.find((s) => solvable.get(s));
const unsolvable = seeds.find((s) => !solvable.get(s));
assert.ok(firstSolvable && unsolvable, "test seeds cover both cases");
let next = 0;
const issued = createSolitaireMatchManifest(() => ({ seed: seeds[next++] }) as MatchManifestV3);
assert.equal(issued.seed, firstSolvable);
assert.throws(() => createSolitaireMatchManifest(() => ({ seed: unsolvable! }) as MatchManifestV3), /SOLITAIRE_NO_SOLVABLE_DEAL/);
const real = createSolitaireMatchManifest();
assert.equal(real.manifest_version, 3);
assert.equal(real.game_id, "solitaire-sprint");
assert.equal(real.game_version, "1.0.0");
assert.ok(isSolvableSolitaireSeed(real.seed));

// 6 · Registered for the shared replay pipeline; the catalogue still plays 0.2.0 until the hidden match ships.
assert.ok(getServerGameAdapter("solitaire-sprint", "1.0.0"));

console.log(`Solitaire V1 OK · private deal, hidden projection, solver solution wins in ${played.actions.length} commands, issuer solvable only · golden ${golden.slice(0, 16)}`);
