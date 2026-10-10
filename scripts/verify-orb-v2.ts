import assert from "node:assert/strict";
import { generateScenario } from "../lib/server/scenarios";
import { canonicalJson } from "../lib/verified/canonical";
import { sha256 } from "../lib/server/matchIntegrity";
import {
  ORB_BURST_CORE as archived,
  forecastOrb as archivedForecast,
} from "../lib/verified/orbBurstCore.v1";
import {
  ORB_BURST_CORE_V2 as core,
  ORB_V2_RULES as rules,
  orbCenterV2,
  orbNeighborsV2,
  orbSourceRowV2,
  orbMissLimitV2,
  forecastOrbV2,
  copyOrbV2State,
  type OrbV2State,
  type OrbV2Bubble,
} from "../lib/verified/orbBurstCore.v2";
import { orbAimAction } from "../lib/verified/orbBurstProtocol.v1";
import {
  applyCoreInput,
  replayCore,
  stepCore,
} from "../lib/verified/coreRuntime.v1";
import type { ReplayInput } from "../lib/verified/inputValidation";
import { verifyCoreFixture } from "./core-test-utils";
import { bestOrbAimV2 } from "./orb-v2-play-fixture";
import fixture from "./fixtures/orb-v2.json" with { type: "json" };
const goal = rules.sourceGoal;
function expand(run: (typeof fixture.runs)[number]): ReplayInput[] {
  return run.inputs.map(([tick, action], seq) => ({
    seq,
    tick: Number(tick),
    action: String(action),
  }));
}
for (const run of [fixture.runs[0], fixture.runs[32]])
  verifyCoreFixture(core, run.seed, expand(run), run.finalTick, goal, {
    score: run.score,
    status: run.status as OrbV2State["status"],
    failure: run.failure,
    hash: run.hash,
  });
// The archived first-board golden remains independently reproducible.
const oldSeed =
  "4550a254df1355bb9b6ae76761123eff54f81eddd86122c0c285e705b4b58454";
const oldInputs = [
  ["AIM_003", 0],
  ["SHOOT", 1],
  ["SHOOT", 379],
  ["AIM_002", 784],
  ["SHOOT", 785],
  ["AIM_003", 1220],
  ["SHOOT", 1221],
].map(([action, tick], seq) => ({
  seq,
  action: String(action),
  tick: Number(tick),
}));
const old = replayCore(archived, oldInputs, 1663, oldSeed, 10000);
assert.equal(old.valid, true);
assert.equal(old.score, 10390);
assert.equal(
  sha256(canonicalJson(old.state)),
  "sha256:922a8bddbdf82c26baed15c64502677ac63099740473afd2c422934f0661dc5f",
);
const fingerprints = new Set<string>();
for (let index = 0; index < 1000; index++) {
  const seed = generateScenario(
      { game_id: "orb-burst", game_version: "2.0.0" },
      index,
    ).seed,
    state = core.create(seed);
  const rows = Array.from({ length: 8 }, (_, i) => orbSourceRowV2(seed, i + 4));
  fingerprints.add(
    sha256(
      canonicalJson({
        opening: state.bubbles.map(({ row, col, color }) => ({
          row,
          col,
          color,
        })),
        supply: rows.map((row) =>
          row.map(({ col, color }) => ({ col, color })),
        ),
      }),
    ),
  );
  assert.deepEqual(core.create(seed), state);
  assert.equal(state.bubbles.length, 36);
  assert.deepEqual(
    state.bubbles.map(({ row, col, color }) => ({ row, col, color })),
    archived.create(seed).bubbles,
  );
  const ids = new Set([...state.bubbles, ...rows.flat()].map((b) => b.id));
  assert.equal(ids.size, 108);
  assert.ok(
    rows.every(
      (row) => row.length === 9 && new Set(row.map((b) => b.color)).size >= 3,
    ),
  );
  const group = state.bubbles.filter(
    (b) => b.row === 3 && b.color === state.currentColor,
  );
  assert.equal(group.length, 3);
  const p = orbCenterV2(state, group[1].row, group[1].col);
  const angle =
    (Math.atan2(
      p.yMilli - rules.shooterYMilli,
      p.xMilli - rules.shooterXMilli,
    ) +
      Math.PI * 2) %
    (Math.PI * 2);
  const aim = Math.max(
    0,
    Math.min(88, Math.round(((angle * 4096) / (Math.PI * 2) - 2192) / 20)),
  );
  const snapshot = canonicalJson(state),
    first = forecastOrbV2(state, aim);
  assert.ok(
    first.state.height >= 3,
    `direct visible triple needs no bank-shot or future knowledge: ${index}`,
  );
  assert.equal(first.state.pressureRows, 0);
  assert.equal(first.state.status, "running");
  assert.equal(first.state.shot, null);
  assert.equal(first.state.settleRemaining, 0);
  assert.equal(canonicalJson(state), snapshot);
}
assert.equal(
  fingerprints.size,
  1000,
  "source geometry/color layouts differ, not just IDs/seeds",
);
assert.throws(() => orbSourceRowV2("bad", 3), /INVALID_SOURCE_ROW/);
assert.throws(() => orbSourceRowV2("bad", 12), /INVALID_SOURCE_ROW/);
console.log(
  "Orb V2: 1000 actual unique finite courses and direct first-shot triples, immutable forecasts",
);
// For every legal discrete aim the first projectile follows the literal V1 integrator until landing.
for (let aim = 0; aim < 89; aim++) {
  const seed = `orb-physics-${aim}`,
    original = archived.create(seed),
    state = core.create(seed);
  original.aimIndex = state.aimIndex = aim;
  archived.apply(original, "SHOOT");
  core.apply(state, "SHOOT");
  while (original.shot || state.shot) {
    assert.deepEqual(state.shot, original.shot);
    archived.step(original);
    core.step(state);
    assert.equal(state.tick, original.tick);
  }
  assert.equal(state.lastLanding?.row, original.lastLanding?.row);
  assert.equal(state.lastLanding?.col, original.lastLanding?.col);
}
function continuity(before: OrbV2State, after: OrbV2State) {
  const descent = after.lastInsertionTick === after.tick,
    map = new Map(after.bubbles.map((b) => [b.id, b]));
  for (const b of before.bubbles) {
    const survivor = map.get(b.id);
    if (!survivor) continue;
    const p = orbCenterV2(before, b.row, b.col),
      q = orbCenterV2(after, survivor.row, survivor.col);
    assert.equal(
      q.xMilli,
      p.xMilli,
      "no sideways teleport during refill/pressure",
    );
    assert.equal(q.yMilli - p.yMilli, descent ? 31000 : 0);
    const prior = orbNeighborsV2(before, b.row, b.col)
      .map(
        (n) =>
          before.bubbles.find((c) => c.row === n.row && c.col === n.col)?.id,
      )
      .filter((id) => id && map.has(id));
    const now = new Set(
      orbNeighborsV2(after, survivor.row, survivor.col).map(
        (n) =>
          after.bubbles.find((c) => c.row === n.row && c.col === n.col)?.id,
      ),
    );
    assert.ok(
      prior.every((id) => now.has(id)),
      "all surviving neighbor relations remain intact",
    );
  }
  assert.ok(
    after.sourceCursor >= before.sourceCursor &&
      after.sourceCursor - before.sourceCursor <= 1,
  );
  assert.ok(after.height >= before.height);
  assert.equal(after.score, after.height);
  assert.equal(new Set(after.removedSourceIds).size, after.height);
  assert.ok(
    before.removedSourceIds.every((id) => after.removedSourceIds.includes(id)),
  );
  assert.equal(
    new Set(after.bubbles.map((b) => b.id)).size,
    after.bubbles.length,
  );
}
let wins = 0,
  shotCount = 0,
  sourceDescents = 0,
  pressureDescents = 0;
for (const run of fixture.runs) {
  const state = core.create(run.seed),
    inputs = expand(run);
  let next = 0,
    absent = 0,
    shotNext = -1;
  while (state.status === "running") {
    if (inputs[next]?.tick === state.tick) {
      const action = inputs[next++].action;
      if (action === "SHOOT") {
        absent = state.bubbles.some((b) => b.color === state.currentColor)
          ? 0
          : absent + 1;
        assert.ok(
          absent <= 1,
          "preview queue never leaves consecutive unmatchable colors",
        );
        shotNext = state.nextColor;
        shotCount++;
      }
      assert.equal(applyCoreInput(core, state, action, goal), true);
    }
    const before = copyOrbV2State(state);
    stepCore(core, state, goal);
    continuity(before, state);
    if (state.shotOrdinal > before.shotOrdinal) {
      assert.equal(
        state.currentColor,
        shotNext,
        "displayed next always becomes current unchanged",
      );
      if (state.status === "running")
        assert.ok(state.bubbles.some((b) => b.color === state.nextColor));
    }
    if (state.lastInsertionTick === state.tick) {
      assert.equal(state.shot, null);
      assert.equal(state.settleRemaining, 18);
      if (state.pressureRows > before.pressureRows) {
        pressureDescents++;
        assert.equal(state.sourceCursor, before.sourceCursor);
      } else {
        sourceDescents++;
        assert.equal(state.sourceCursor, before.sourceCursor + 1);
      }
    }
  }
  assert.equal(next, inputs.length);
  assert.equal(state.tick, run.finalTick);
  assert.equal(sha256(canonicalJson(state)), run.hash);
  assert.deepEqual(
    replayCore(core, inputs, state.tick, run.seed, goal).state,
    state,
  );
  if (run.case === "win") {
    wins++;
    assert.equal(state.height, 108);
    assert.equal(state.status, "won");
    assert.equal(state.sourceCursor, 12);
    assert.equal(state.removedSourceIds.length, 108);
  } else {
    assert.equal(state.status, "failed");
    assert.equal(state.failure, "BOARD_OVERFLOW");
    assert.equal(
      state.height,
      0,
      "deliberate pressure/shots cannot earn advancement",
    );
  }
}
assert.equal(wins, 32);
assert.ok(sourceDescents >= 32 * 8);
assert.ok(pressureDescents >= 2);
console.log(
  `Orb V2: ${wins} naturally solved full-course frozen replays, ${shotCount} legal shots, source/pressure continuity and stable preview`,
);
// Solve two new seeds live, using only current visible cells and current ammunition.
for (const index of [32, 33]) {
  const seed = generateScenario(
      { game_id: "orb-burst", game_version: "2.0.0" },
      index,
    ).seed,
    state = core.create(seed),
    inputs: ReplayInput[] = [];
  const send = (action: string) => {
    assert.equal(applyCoreInput(core, state, action, goal), true);
    inputs.push({ seq: inputs.length, tick: state.tick, action });
  };
  for (let shots = 0; state.status === "running" && shots < 150; shots++) {
    const aim = bestOrbAimV2(state);
    if (aim !== state.aimIndex) {
      send(orbAimAction(aim));
      stepCore(core, state, goal);
    }
    send("SHOOT");
    while (state.status === "running" && (state.shot || state.settleRemaining))
      stepCore(core, state, goal);
  }
  assert.equal(state.status, "won");
  assert.deepEqual(
    replayCore(core, inputs, state.tick, seed, goal).state,
    state,
  );
}
// Exact boundary/recovery cases are separate from the full legal-input gameplay traces.
function collisionField(bubbles: OrbV2Bubble[], color = 0): OrbV2State {
  const state = core.create("orb-boundaries");
  state.bubbles = bubbles;
  state.sourceCursor = 12;
  state.currentColor = color;
  state.nextColor = color;
  // Contact is five pixels before the free hex-cell centre, inside the actual
  // collision radius. A stationary shot at the cell centre would not collide.
  const row = Math.max(...bubbles.map((bubble) => bubble.row)) + 1;
  const p = orbCenterV2(state, row, 3);
  state.shot = {
    ...p,
    yMilli: p.yMilli - 5000,
    vxMilli: 0,
    vyMilli: 0,
    xRemainder: 0,
    yRemainder: 0,
    color,
  };
  return state;
}
const a: OrbV2Bubble = {
    row: 0,
    col: 3,
    color: 0,
    id: "source:11:3",
    origin: "source",
  },
  b: OrbV2Bubble = { ...a, col: 4, id: "source:11:4" },
  garbage: OrbV2Bubble = {
    row: 0,
    col: 7,
    color: 2,
    id: "pressure:1:7",
    origin: "pressure",
  };
for (const remaining of [1, 2]) {
  const first =
      remaining === 1 ? { ...b, id: "shot:900", origin: "shot" as const } : b,
    state = collisionField([a, first, garbage]);
  const all = Array.from(
    { length: 108 },
    (_, i) => `source:${Math.floor(i / 9)}:${i % 9}`,
  );
  state.removedSourceIds = all.filter(
    (id) => id !== a.id && (remaining === 1 || id !== b.id),
  );
  state.height = state.score = 108 - remaining;
  stepCore(core, state, goal);
  assert.equal(state.status, "won");
  assert.equal(state.height, 108);
  assert.ok(
    state.bubbles.some((cell) => cell.id === garbage.id),
    "goal does not require clearing non-source garbage",
  );
}
const noFarm = collisionField([
  { ...a, id: "shot:99", origin: "shot" },
  { ...b, id: "pressure:9:4", origin: "pressure" },
]);
stepCore(core, noFarm, goal);
assert.equal(noFarm.height, 0);
assert.equal(noFarm.score, 0);
assert.equal(noFarm.status, "running");
const pressure = collisionField([{ ...a, color: 1 }], 0);
pressure.sourceCursor = 4;
pressure.misses = rules.initialMisses - 1;
const oldPressure = copyOrbV2State(pressure);
stepCore(core, pressure, goal);
assert.equal(pressure.pressureRows, 1);
assert.equal(
  pressure.sourceCursor,
  4,
  "eligible supply does not follow pressure in same settlement",
);
assert.equal(pressure.height, 0);
continuity(oldPressure, pressure);
const dangerous = collisionField([{ ...a, row: 14, color: 1 }], 0);
dangerous.sourceCursor = 4;
stepCore(core, dangerous, goal);
assert.equal(dangerous.failure, "BOARD_OVERFLOW");
assert.equal(dangerous.sourceCursor, 5);
assert.equal(
  dangerous.bubbles.filter(
    (cell) => cell.origin === "source" && cell.id.startsWith("source:4:"),
  ).length,
  9,
);
const idle = core.create("orb-idle-boundary"),
  idleBefore = copyOrbV2State(idle);
idle.tick = rules.idlePressureTicks - 1;
stepCore(core, idle, goal);
assert.equal(idle.pressureRows, 1);
assert.equal(idle.height, 0);
assert.equal(idle.sourceCursor, 4);
assert.equal(idle.settleRemaining, 18);
continuity(idleBefore, idle);
const late = core.create("late");
late.height = 54;
assert.equal(orbMissLimitV2(late), 3);
late.height = 53;
assert.equal(orbMissLimitV2(late), 4);
const bounds = core.create("bounds");
assert.equal(applyCoreInput(core, bounds, "FORBIDDEN", goal), false);
bounds.aimIndex = 0;
assert.equal(applyCoreInput(core, bounds, "AIM_LEFT", goal), false);
bounds.aimIndex = 88;
assert.equal(applyCoreInput(core, bounds, "AIM_RIGHT", goal), false);
assert.equal(applyCoreInput(core, bounds, "SHOOT", goal), true);
assert.equal(applyCoreInput(core, bounds, "SHOOT", goal), false);
assert.equal(applyCoreInput(core, bounds, "AIM_001", goal), false);
while (bounds.shot) stepCore(core, bounds, goal);
assert.equal(applyCoreInput(core, bounds, "SHOOT", goal), false);
while (bounds.settleRemaining) stepCore(core, bounds, goal);
assert.equal(core.canApply(bounds, "SHOOT"), true);
assert.throws(() => forecastOrbV2(bounds, -1), /INVALID_AIM/);
assert.throws(() => forecastOrbV2(bounds, 89), /INVALID_AIM/);
const timeout = core.create("orb-timeout");
while (timeout.status === "running") stepCore(core, timeout, goal);
assert.ok(["TIME_LIMIT", "BOARD_OVERFLOW"].includes(timeout.failure ?? ""));
assert.equal(
  replayCore(core, [], timeout.tick, timeout.seed, goal).valid,
  true,
);
console.log(
  "Orb V2: V1 projectile parity, 34 full wins, last targets/garbage, pressure exclusion, no farming, bounds/cooldown/idle/loss passed",
);
