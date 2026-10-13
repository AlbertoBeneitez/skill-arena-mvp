import assert from "node:assert/strict";
import {
  SLOT_CORE as core,
  SLOT_RULES,
  slotPayout,
  type SlotState,
} from "../lib/verified/galacticSlotCore.v1";
import {
  applyCoreInput,
  stepCore,
  replayCore,
} from "../lib/verified/coreRuntime.v1";
import {
  createMatchManifest,
  issueAttemptTicket,
  processAttemptRecord,
} from "../lib/server/verifiedMatch";
import { canonicalJson } from "../lib/verified/canonical";
import { sha256 } from "../lib/server/matchIntegrity";
import { verifyCoreFixture } from "./core-test-utils";
import { generateScenario } from "../lib/server/scenarios";
import type { ReplayInput } from "../lib/verified/inputValidation";
import fixture from "./fixtures/slot-v1.json" with { type: "json" };
function run(seed: string, mode: "win" | "loss") {
  const s = core.create(seed),
    inputs: ReplayInput[] = [];
  function action(a: string) {
    while (!core.canApply(s, a) && s.status === "running")
      stepCore(core, s, 1e9);
    if (s.status === "running") {
      inputs.push({ seq: inputs.length, tick: s.tick, action: a });
      assert.ok(applyCoreInput(core, s, a, 1e9));
    }
  }
  while (s.status === "running") {
    if (s.settlingAt !== -1 || s.tick > core.maxFinalTick - 360) {
      stepCore(core, s, 1e9);
      continue;
    }
    const targets = mode === "win" ? [7, 7, 7] : [0, 1, 2];
    for (let i = 0; i < 3; i++) {
      const n = (s.strips[i].indexOf(targets[i]) - s.positions[i] + 8) % 8 || 8;
      while (s.steps[i] !== n) action(`REEL_${i}_MORE`);
    }
    action("SPIN");
  }
  return { s, inputs };
}
verifyCoreFixture(core, fixture.seed, fixture.inputs, fixture.finalTick, 1e9, {
  score: fixture.score,
  status: "won",
  failure: null,
  hash: fixture.hash,
});
const sets = new Set<string>();
for (let i = 0; i < 1000; i++) {
  const seed = generateScenario(
      { game_id: core.gameId, game_version: core.gameVersion },
      i,
    ).seed,
    s = core.create(seed);
  assert.ok(s.strips.every((r) => new Set(r).size === 8));
  assert.deepEqual(core.create(seed), s);
  sets.add(canonicalJson({ strips: s.strips, positions: s.positions }));
  if (i < 16)
    for (const mode of ["win", "loss"] as const) {
      const { s, inputs } = run(seed, mode);
      assert.equal(s.status, mode === "win" ? "won" : "failed");
      assert.ok(inputs.length < core.maxInputs);
      assert.deepEqual(replayCore(core, inputs, s.tick, seed, 1e9).state, s);
      if (mode === "loss") {
        assert.equal(s.spins, 20);
        assert.equal(s.balanceMinor, 0);
        assert.equal(s.failure, "EMPTY_BALANCE");
      } else {
        assert.equal(s.tick, 21600);
        assert.ok(s.spins >= 50);
      }
    }
}
assert.equal(sets.size, 1000);
for (let i = 0; i < 8; i++)
  assert.equal(slotPayout([i, i, i]), 500 * SLOT_RULES.tripleMultipliers[i]);
assert.equal(slotPayout([0, 0, 7]), 1000);
assert.equal(slotPayout([0, 1, 7]), 500);
assert.equal(slotPayout([0, 1, 2]), 0);
const s = core.create("no-double-charge"),
  order = canonicalJson(s.strips);
assert.ok(applyCoreInput(core, s, "SPIN", 1));
assert.equal(s.status, "running", "target cannot end a live balance session");
assert.equal(s.balanceMinor, 9500);
assert.equal(applyCoreInput(core, s, "SPIN", 1e9), false);
assert.equal(applyCoreInput(core, s, "REEL_0_MORE", 1e9), false);
for (let t = 0; t < 360; t++) stepCore(core, s, 1e9);
assert.equal(s.spins, 1);
assert.equal(canonicalJson(s.strips), order);
assert.equal(s.score, 0);
const idle = core.create("idle");
for (let t = 0; t < 21600; t++) stepCore(core, idle, 1);
assert.equal(idle.status, "won");
assert.equal(idle.balanceMinor, 10000);
assert.equal(
  replayCore(
    core,
    [
      { seq: 0, tick: 0, action: "SPIN" },
      { seq: 1, tick: 1, action: "SPIN" },
    ],
    21600,
    "invalid-spin",
  ).error,
  "ACTION_NOT_AVAILABLE",
);
console.log(
  "Slot: 1000 distinct fixed setups, 32 complete sessions, payouts/insolvency/timeout/input locking and historical runtime preserved",
);

const manifest = createMatchManifest({
    gameId: core.gameId,
    gameVersion: core.gameVersion,
    seed: fixture.seed,
    targetScore: 1e9,
  }),
  ticket = issueAttemptTicket({ manifest, playerId: "slot-fixture-player" });
const payload = {
  manifest,
  ticket,
  inputs: fixture.inputs,
  final_tick: fixture.finalTick,
};
const originalNow = Date.now;
try {
  Date.now = () => Date.parse(ticket.issued_at) + 181000;
  const checked = processAttemptRecord({
    ...payload,
    score: 999999999,
    balanceMinor: 999999999,
  });
  assert.equal(checked.body.verified, true);
  assert.equal(
    checked.body.score,
    fixture.score,
    "client money must never be used",
  );
  assert.equal(
    processAttemptRecord({
      ...payload,
      manifest: { ...manifest, seed: "chosen-by-client" },
    }).body.verified,
    false,
  );
} finally {
  Date.now = originalNow;
}
console.log(
  "Slot endpoint: signed manifest, input-only authoritative replay, ignored client wealth and rejected seed tampering",
);
