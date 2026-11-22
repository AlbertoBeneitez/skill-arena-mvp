import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { MemoryMatchRepository } from "../lib/server/demo/memoryMatchRepository";
import { MemoryCommandAttemptRepository } from "../lib/server/demo/memoryCommandAttemptRepository";
import { HiddenCommandAuthority, SERVER_TIME_UP_COMMAND_ID } from "../lib/server/hiddenCommandAuthority";
import { hashManifest } from "../lib/server/matchIntegrity";
import { createSolitaireMatchManifest, solitaireDeckFromSeed } from "../lib/server/solitaireDeals";
import { createPrivateMatchManifest } from "../lib/server/privateMatchIssuer";
import { SOLITAIRE_CORE_V1, createSolitaireV1, projectSolitaireV1 } from "../lib/verified/solitaireCore.v1.server";
import { SOLITAIRE_V1_TIME_LIMIT_MS } from "../lib/verified/solitaireProtocol.v1";
import { MINE_GRID_CORE_V2, projectMineV2 } from "../lib/verified/mineGridCore.v2";
import { solveKlondike } from "../lib/solitaireSolver";

// Server clock for hidden attempts: elapsed time from the server's own timestamps, a 5-minute limit closed by the
// server with TIME_UP at the deadline, and games without a time rule unchanged.
const START = 1_795_300_000_000;
let now = START;
const clock = () => now;
const matches = new MemoryMatchRepository(),
  attempts = new MemoryCommandAttemptRepository();
const solitaire = new HiddenCommandAuthority(
  matches,
  attempts,
  { core: SOLITAIRE_CORE_V1, project: projectSolitaireV1, clock: { limitMs: SOLITAIRE_V1_TIME_LIMIT_MS, timeUpAction: "TIME_UP" } },
  "demo",
  clock,
);
const manifest = createSolitaireMatchManifest();
await matches.createMatch(manifest, { A: "clock-a", B: "clock-b" });
async function open(playerId: string) {
  const attemptId = randomUUID();
  await attempts.create({
    attemptId, playerId, matchId: manifest.match_id, manifestHash: hashManifest(manifest),
    revision: 0, inputs: [], commands: [], terminal: false, startedAtMs: now, finishedAtMs: null,
  });
  return attemptId;
}
let commandNo = 0;
const send = (attemptId: string, playerId: string, expectedRevision: number, action: string) =>
  solitaire.command({ attemptId, commandId: `c${commandNo++}`, expectedRevision, action }, playerId);

// 1 · Elapsed time comes from the server clock; the player's moves are applied while time remains.
const a = await open("clock-a");
now = START + 12_345;
let view = await solitaire.read(a, "clock-a");
assert.equal(view.status, "running");
assert.equal(view.timeLimitMs, 300_000);
assert.equal(view.elapsedMs, 12_345);
view = await send(a, "clock-a", 0, "DRAW");
assert.equal(view.revision, 1);

// 2 · After the limit a move is not applied: the server closes the attempt with TIME_UP at the deadline.
now = START + SOLITAIRE_V1_TIME_LIMIT_MS + 4_000;
view = await send(a, "clock-a", 1, "DRAW");
assert.equal(view.status, "failed");
assert.equal(view.failure, "TIME_UP");
assert.equal(view.revision, 2);
assert.equal(view.elapsedMs, SOLITAIRE_V1_TIME_LIMIT_MS, "capped at the limit");
const closed = await attempts.findForPlayer(a, "clock-a");
assert.equal(closed!.finishedAtMs, START + SOLITAIRE_V1_TIME_LIMIT_MS);
assert.equal(closed!.commands.at(-1)!.commandId, SERVER_TIME_UP_COMMAND_ID);
assert.deepEqual(closed!.inputs.map((i) => i.action), ["DRAW", "TIME_UP"]);
await assert.rejects(send(a, "clock-a", 2, "DRAW"), /ATTEMPT_CLOSED/);
// Later reads show the same final time, not a growing one.
now += 60_000;
assert.equal((await solitaire.read(a, "clock-a")).elapsedMs, SOLITAIRE_V1_TIME_LIMIT_MS);

// 3 · An attempt nobody touches is closed by the first read after the deadline, once, even with concurrent reads.
now = START;
const idle = await open("clock-b");
now = START + SOLITAIRE_V1_TIME_LIMIT_MS;
const [r1, r2] = await Promise.all([solitaire.read(idle, "clock-b"), solitaire.read(idle, "clock-b")]);
assert.equal(r1.status, "failed");
assert.equal(r2.status, "failed");
assert.equal((await attempts.findForPlayer(idle, "clock-b"))!.revision, 1, "TIME_UP appended once");

// 4 · A solve before the limit stops the clock at the server time of the winning command.
const solo = createSolitaireMatchManifest();
await matches.createMatch(solo, { A: "solver", B: "solver-peer" });
now = START;
const wonId = randomUUID();
await attempts.create({
  attemptId: wonId, playerId: "solver", matchId: solo.match_id, manifestHash: hashManifest(solo),
  revision: 0, inputs: [], commands: [], terminal: false, startedAtMs: now, finishedAtMs: null,
});
const solution = solveKlondike(solitaireDeckFromSeed(solo.seed), 250_000);
assert.ok(solution.solved);
const local = createSolitaireV1(solo.seed);
const actions: string[] = [];
const push = (action: string) => {
  SOLITAIRE_CORE_V1.apply(local, action);
  actions.push(action);
};
for (const m of solution.moves) {
  if (local.status !== "running") break;
  if (m.from === "talon") {
    while (local.waste.at(-1) !== m.card) push("DRAW");
    push(m.kind === "foundation" ? "W>F" : `W>T${m.to}`);
  } else push(m.kind === "foundation" ? `T${m.from}>F` : `T${m.from}>T${m.to}`);
}
assert.equal(local.status, "won");
let revision = 0;
for (const action of actions) {
  now += 400;
  view = await send(wonId, "solver", revision++, action);
}
assert.equal(view.status, "won");
assert.equal(view.elapsedMs, actions.length * 400);
assert.equal((await attempts.findForPlayer(wonId, "solver"))!.finishedAtMs, START + actions.length * 400);
now += 120_000;
assert.equal((await solitaire.read(wonId, "solver")).elapsedMs, actions.length * 400, "the clock stays stopped");

// 5 · A game without a time rule (Mine Grid V2) has no clock fields and is never closed for time.
const mine = new HiddenCommandAuthority(matches, attempts, { core: MINE_GRID_CORE_V2, project: projectMineV2 }, "demo", clock);
const mineManifest = createPrivateMatchManifest("mine-grid", "2.0.0");
await matches.createMatch(mineManifest, { A: "mine-a", B: "mine-b" });
const mineId = randomUUID();
await attempts.create({
  attemptId: mineId, playerId: "mine-a", matchId: mineManifest.match_id, manifestHash: hashManifest(mineManifest),
  revision: 0, inputs: [], commands: [], terminal: false, startedAtMs: now, finishedAtMs: null,
});
now += 10 * SOLITAIRE_V1_TIME_LIMIT_MS;
const mineView = await mine.read(mineId, "mine-a");
assert.equal(mineView.status, "running");
assert.equal("elapsedMs" in mineView, false);

console.log(`Hidden clock OK · server-measured time, 5-min limit closed by the server at the deadline (once), solve stops the clock at ${actions.length} commands, Mine Grid untouched`);
