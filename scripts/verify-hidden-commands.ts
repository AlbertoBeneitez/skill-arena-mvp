import assert from "node:assert/strict";
import { createPrivateMatchManifest } from "../lib/server/privateMatchIssuer";
import { validateManifest } from "../lib/server/verifiedMatch";
import { hashManifest } from "../lib/server/matchIntegrity";
import { generatePrivateScenario } from "../lib/server/scenarios";
import { MemoryMatchRepository } from "../lib/server/demo/memoryMatchRepository";
import { MemoryCommandAttemptRepository } from "../lib/server/demo/memoryCommandAttemptRepository";
import { HiddenCommandAuthority } from "../lib/server/hiddenCommandAuthority";
import {
  CommandAuthorityError,
  type StoredCommandAttempt,
} from "../lib/server/commandAttemptRepository";
import {
  MINE_GRID_CORE as core,
  projectMineState,
} from "../lib/verified/mineGridCore.v1";
import { nextMineAction } from "./mine-play-fixture";
import { replayCore } from "../lib/verified/coreRuntime.v1";
const matches = new MemoryMatchRepository(),
  attempts = new MemoryCommandAttemptRepository(),
  manifest = createPrivateMatchManifest("mine-grid", "1.0.0");
assert.equal(validateManifest(manifest).ok, false);
assert.equal(validateManifest(manifest, { allowV3: true }).ok, false);
assert.equal(
  validateManifest(manifest, { allowV3: true, allowPrivateScenario: true }).ok,
  true,
);
const entropy = "01".repeat(32),
  id = "private-seed-v1:00000000-0000-4000-8000-000000000007";
assert.deepEqual(
  generatePrivateScenario(
    { game_id: "mine-grid", game_version: "1.0.0" },
    entropy,
    id,
  ),
  generatePrivateScenario(
    { game_id: "mine-grid", game_version: "1.0.0" },
    entropy,
    id,
  ),
);
assert.notEqual(
  generatePrivateScenario(
    { game_id: "mine-grid", game_version: "1.0.0" },
    entropy,
    id,
  ).seed,
  generatePrivateScenario(
    { game_id: "mine-grid", game_version: "1.0.0" },
    "02".repeat(32),
    id,
  ).seed,
);
await matches.createMatch(manifest, { A: "local-demo-a", B: "local-demo-b" });
const create = (playerId: string, attemptId: string): StoredCommandAttempt => ({
  attemptId,
  playerId,
  matchId: manifest.match_id,
  manifestHash: hashManifest(manifest),
  revision: 0,
  inputs: [],
  commands: [],
  terminal: false,
});
await attempts.create(create("local-demo-a", "attempt-a"));
await attempts.create(create("local-demo-b", "attempt-b"));
const authority = new HiddenCommandAuthority(
  matches,
  attempts,
  { core, project: projectMineState },
  "demo",
);
const a = await authority.read("attempt-a", "local-demo-a"),
  b = await authority.read("attempt-b", "local-demo-b");
assert.deepEqual(a.view, b.view);
assert.equal(a.scenarioId, b.scenarioId);
assert.equal(JSON.stringify(a).includes(manifest.seed), false);
assert.equal("manifest" in a, false);
assert.equal("seed" in a, false);
const code = (expected: string) => (error: unknown) =>
  error instanceof CommandAuthorityError && error.code === expected;
await assert.rejects(
  authority.read("attempt-a", "local-demo-b"),
  code("NOT_FOUND"),
);
const action = nextMineAction(core.create(manifest.seed)),
  request = {
    attemptId: "attempt-a",
    commandId: "first",
    expectedRevision: 0,
    action,
  };
const duplicates = await Promise.all(
  Array.from({ length: 12 }, () => authority.command(request, "local-demo-a")),
);
duplicates.forEach((view) => assert.equal(view.revision, 1));
assert.equal(
  (await attempts.findForPlayer("attempt-a", "local-demo-a"))!.inputs.length,
  1,
);
await assert.rejects(
  authority.command({ ...request, action: "FLAG_000" }, "local-demo-a"),
  code("COMMAND_CONFLICT"),
);
await assert.rejects(
  authority.command({ ...request, commandId: "stale" }, "local-demo-a"),
  code("REVISION_CONFLICT"),
);
await assert.rejects(
  authority.command(
    { ...request, seed: "client-seed" } as typeof request,
    "local-demo-a",
  ),
  code("INVALID_COMMAND"),
);
let revision = 1;
while (true) {
  const record = (await attempts.findForPlayer("attempt-a", "local-demo-a"))!,
    state = replayCore(
      core,
      [...record.inputs],
      record.inputs.at(-1)?.tick ?? 0,
      manifest.seed,
      1e9,
    ).state;
  if (state.status !== "running") break;
  const next = nextMineAction(state),
    view = await authority.command(
      {
        attemptId: "attempt-a",
        commandId: `next-${revision}`,
        expectedRevision: revision,
        action: next,
      },
      "local-demo-a",
    );
  revision = view.revision;
}
const result = await authority.read("attempt-a", "local-demo-a");
assert.equal(result.status, "won");
assert.equal(result.verified, true);
assert.equal(JSON.stringify(result).includes(manifest.seed), false);
await assert.rejects(
  authority.command(
    {
      attemptId: "attempt-a",
      commandId: "after-close",
      expectedRevision: revision,
      action,
    },
    "local-demo-a",
  ),
  code("ATTEMPT_CLOSED"),
);
assert.equal((await authority.read("attempt-b", "local-demo-b")).revision, 0);
console.log(
  "Hidden authority: public projection only, private seed entropy, historical HTTP rejects private manifests, one accepted concurrent retry, membership, stale/conflicting/extra-field rejection, independent participants, final common replay",
);

const { getLocalHiddenGames } = await import(
  "../lib/server/demo/localHiddenGames"
);
const priorLocal = process.env.ALLOW_LOCAL_HIDDEN_GAMES,
  priorVercel = process.env.VERCEL;
try {
  process.env.ALLOW_LOCAL_HIDDEN_GAMES = "1";
  process.env.VERCEL = "1";
  assert.throws(
    () => getLocalHiddenGames(),
    (error) =>
      error instanceof CommandAuthorityError && error.code === "UNAVAILABLE",
  );
} finally {
  if (priorLocal === undefined) delete process.env.ALLOW_LOCAL_HIDDEN_GAMES;
  else process.env.ALLOW_LOCAL_HIDDEN_GAMES = priorLocal;
  if (priorVercel === undefined) delete process.env.VERCEL;
  else process.env.VERCEL = priorVercel;
}
