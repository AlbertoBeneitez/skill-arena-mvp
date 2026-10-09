import assert from "node:assert/strict";
import { canonicalJson } from "../lib/verified/canonical";
import { sha256 } from "../lib/server/matchIntegrity";
import { generateScenario } from "../lib/server/scenarios";
import {
  applyCoreInput,
  replayCore,
  stepCore,
} from "../lib/verified/coreRuntime.v1";
import type { ReplayInput } from "../lib/verified/inputValidation";
import {
  SKY_HOP_CORE,
  SKY_HOP_RULES,
  hopPlatformX,
  type SkyHopState,
} from "../lib/verified/skyHopCore.v1";
import { SKY_HOP_CORE_V2 } from "../lib/verified/skyHopCore.v2";
import {
  SKY_HOP_CORE_V3 as core,
  SKY_HOP_ENEMY_RULES as rules,
  hopEnemyActive,
  hopEnemyVisible,
  hopEnemyX,
  type SkyHopV3State,
} from "../lib/verified/skyHopCore.v3";
import { verifyCoreFixture } from "./core-test-utils";
import { chooseHopAction } from "./sky-hop-play-fixture";
import { chooseHopEncounterAction } from "./sky-hop-v3-play-fixture";
import historical from "./fixtures/sky-hop-v1.json" with { type: "json" };
import fixture from "./fixtures/sky-hop-v3.json" with { type: "json" };
const target = 1e6;
function projection(state: SkyHopV3State): SkyHopState {
  const original = SKY_HOP_CORE_V2.create(state.seed);
  return Object.fromEntries(
    Object.keys(original).map((key) => [key, state[key as keyof SkyHopState]]),
  ) as SkyHopState;
}
for (const archived of [SKY_HOP_CORE, SKY_HOP_CORE_V2]) {
  const old = replayCore(
    archived,
    historical.inputs,
    historical.finalTick,
    historical.seed,
    target,
  );
  assert.equal(old.valid, true);
  assert.equal(old.score, historical.score);
  assert.equal(
    sha256(canonicalJson(old.state)),
    historical.hash,
    "V1/V2 historical state and hash stay frozen",
  );
}
assert.equal(core.gameVersion, "3.0.0");
assert.equal(core.inputVersion, 1);
assert.deepEqual(core.actions, SKY_HOP_CORE.actions);
for (const run of fixture.runs) {
  const replay = verifyCoreFixture(
    core,
    run.seed,
    run.inputs,
    run.finalTick,
    target,
    {
      score: run.score,
      hash: run.hash,
      status: run.status as SkyHopState["status"],
      failure: run.failure,
    },
  );
  assert.equal(replay.state.highest, run.highest);
  assert.equal(replay.state.enemyContacts, run.enemyContacts);
  assert.equal(replay.state.stomps, run.stomps);
  assert.equal(
    generateScenario(
      { game_id: "sky-hop", game_version: "3.0.0" },
      run.scenarioIndex,
    ).seed,
    run.seed,
  );
}

let countMin = Infinity,
  countMax = 0,
  countTotal = 0;
const fingerprints = new Set<string>();
for (let index = 0; index < 1000; index++) {
  const seed = generateScenario(
    { game_id: "sky-hop", game_version: "3.0.0" },
    index,
  ).seed;
  const state = core.create(seed),
    base = SKY_HOP_CORE_V2.create(seed);
  assert.deepEqual(
    projection(state),
    base,
    "all 75 original supports and initial conditions remain identical",
  );
  // The fingerprint deliberately excludes the seed, scenario ID and timestamps.
  fingerprints.add(
    sha256(
      canonicalJson({
        platforms: state.platforms.map(({ drift, period, phase, ...surface }) => ({
          ...surface,
          ...(drift ? { drift, period, phase } : {}),
        })),
        enemies: state.enemies,
      }),
    ),
  );
  countMin = Math.min(countMin, state.enemies.length);
  countMax = Math.max(countMax, state.enemies.length);
  countTotal += state.enemies.length;
  assert.ok(
    state.enemies.length >= 3,
    "every sampled course has visible sentries",
  );
  for (let i = 0; i < state.enemies.length; i++) {
    const enemy = state.enemies[i],
      p = state.platforms[enemy.platform];
    assert.ok(enemy.platform >= 14 && enemy.platform < 75);
    assert.ok(
      enemy.platform % 10 >= 3,
      "checkpoints and their first two recovery supports stay clear",
    );
    assert.ok(
      p.kind === "normal" || p.kind === "moving",
      "boost/crumble supports never gain sentries",
    );
    assert.ok(!i || enemy.platform - state.enemies[i - 1].platform >= 3);
    assert.equal(enemy.y - p.y, 24000);
    assert.ok(
      enemy.y - rules.halfHeight > p.y,
      "entire body is below support; ordinary departure cannot cross it",
    );
    for (let tick = 0; tick <= enemy.period; tick++) {
      const x = hopEnemyX(state, enemy, tick),
        platformX = hopPlatformX(p, tick);
      assert.ok(
        x >= 20000 && x <= 370000,
        "complete collider/antenna remains in the shared 390px FOV",
      );
      assert.ok(x - rules.halfWidth > 0 && x + rules.halfWidth < 390000);
      const outset = enemy.side < 0 ? platformX - x : x - platformX - p.width;
      assert.ok(outset >= rules.outsetMin && outset <= rules.outsetMax);
      const centre = platformX + p.width / 2;
      assert.ok(
        Math.abs(centre - x) - rules.halfWidth - SKY_HOP_RULES.halfWidth >=
          47000,
        "47px lateral clearance even on a 94px support",
      );
    }
    // Independently cover the support's extrema, not just the enemy's patrol cycle.
    for (const tick of [
      p.period - p.phase,
      Math.floor(p.period / 2) - p.phase,
      enemy.period - enemy.phase,
      Math.floor(enemy.period / 2) - enemy.phase,
    ].map((tick) => (tick < 0 ? tick + p.period + enemy.period : tick))) {
      const x = hopEnemyX(state, enemy, tick);
      assert.ok(x >= 20000 && x <= 370000);
    }
  }
  for (let tick = 0; tick < 600; tick++) {
    stepCore(core, state, target);
    stepCore(SKY_HOP_CORE_V2, base, target);
  }
  assert.equal(
    state.lives,
    3,
    "five easy seconds teach automatic bounce without damage",
  );
  assert.ok(state.highest >= 3);
  assert.equal(state.enemyContacts, 0);
  assert.deepEqual(
    projection(state),
    base,
    "V3 opening literally follows V2 physics",
  );
}
assert.equal(
  fingerprints.size,
  1000,
  "1000 actual course geometries, not 1000 renamed identical seeds",
);
console.log(
  `Sky V3: 1000 unique geometries, sentries ${countMin}..${countMax} (total ${countTotal}), all patrol/support bounds and safe openings`,
);

function fullRun(seed: string, cadence = 1) {
  const state = core.create(seed),
    inputs: ReplayInput[] = [];
  while (state.status === "running") {
    const action = state.tick % cadence === 0 ? chooseHopAction(state) : null;
    if (action) {
      assert.equal(applyCoreInput(core, state, action, target), true);
      inputs.push({ seq: inputs.length, tick: state.tick, action });
    }
    stepCore(core, state, target);
  }
  assert.equal(
    state.status,
    "won",
    `learned central route remains playable: ${seed} at ${cadence} ticks`,
  );
  assert.equal(state.highest, 75);
  const replay = replayCore(core, inputs, state.tick, seed, target);
  assert.equal(replay.valid, true);
  assert.deepEqual(replay.state, state);
}
for (let index = 0; index < 32; index++) {
  fullRun(`sky-v3-course-${index}`);
  const seed = generateScenario(
    { game_id: "sky-hop", game_version: "3.0.0" },
    index,
  ).seed;
  fullRun(seed);
  fullRun(seed, 8); // Native steering observations may arrive up to 66.7ms apart.
}
console.log(
  "Sky V3: 96 full legal-input ascents/replays using unchanged legacy steering, including 32 at 66.7ms cadence",
);

// Reconstruct golden encounters through real inputs; assert recovery at the event itself.
for (const run of fixture.runs) {
  const state = core.create(run.seed);
  let next = 0,
    contacts = 0,
    stomps = 0;
  while (state.status === "running") {
    if (run.inputs[next]?.tick === state.tick)
      assert.equal(
        applyCoreInput(core, state, run.inputs[next++].action, target),
        true,
      );
    const before = {
      highest: state.highest,
      height: state.height,
      collected: [...state.collected],
      defeated: [...state.enemyDefeatedAt],
      broken13: state.brokenAt[13],
      checkpoint: state.checkpoint,
      score: state.score,
    };
    stepCore(core, state, target);
    if (state.enemyContacts > contacts) {
      assert.equal(state.highest, before.highest);
      assert.equal(state.height, before.height);
      assert.deepEqual(
        state.collected,
        before.collected,
        "enemy damage cannot refresh used life pickups",
      );
      assert.deepEqual(state.enemyDefeatedAt, before.defeated);
      assert.equal(state.score, Math.max(0, before.score - 350));
      if (state.status === "running") {
        assert.equal(state.lastLandingIndex, before.checkpoint);
        assert.equal(state.respawnUntil, state.tick + 90);
        assert.ok(
          state.brokenAt
            .slice(before.checkpoint + 1)
            .every((tick) => tick === -1),
        );
        assert.ok(
          state.enemyArmedAt.every(
            (tick, i) => state.enemyDefeatedAt[i] >= 0 || tick === -1,
          ),
        );
      }
      if (contacts === 0 && run.scenarioIndex === 12) {
        assert.ok(before.broken13 > 0 && before.checkpoint === 10);
        assert.equal(before.collected[13], true);
        assert.equal(
          state.brokenAt[13],
          -1,
          "natural hostile recovery restores the previously crumbled bridge",
        );
      }
      contacts = state.enemyContacts;
    }
    if (state.stomps > stomps) {
      assert.equal(
        state.score,
        before.score,
        "stomp never awards farmable points",
      );
      assert.equal(state.highest, before.highest);
      assert.equal(state.vy, SKY_HOP_RULES.bounce);
      assert.ok(state.enemyDefeatedAt.some((tick) => tick === state.tick));
      stomps = state.stomps;
    }
  }
  assert.equal(next, run.inputs.length);
  assert.equal(state.tick, run.finalTick);
}
// Check helper-generated golden paths remain natural rather than position injection.
for (const run of fixture.runs.filter((run) => run.case !== "contact-loss")) {
  const state = core.create(run.seed),
    inputs: ReplayInput[] = [];
  let index = -1,
    attempted = false,
    pursuing = false;
  while (state.status === "running") {
    if (!attempted) {
      index = state.enemies.findIndex(
        (enemy) => enemy.platform === state.lastLandingIndex,
      );
      if (index >= 0) {
        attempted = true;
        pursuing = true;
      }
    }
    const action: string | null = pursuing
      ? chooseHopEncounterAction(state, index)
      : chooseHopAction(state);
    if (action) {
      assert.equal(applyCoreInput(core, state, action, target), true);
      inputs.push({ seq: inputs.length, tick: state.tick, action });
    }
    const interactions = state.enemyContacts + state.stomps;
    stepCore(core, state, target);
    if (state.enemyContacts + state.stomps > interactions) pursuing = false;
  }
  assert.deepEqual(inputs, run.inputs);
}

// A natural ordinary fall after crumble still restores the course and finishes.
for (let sample = 0; sample < 4; sample++) {
  const seed = `recovery-probe-${sample}`,
    state = core.create(seed),
    inputs: ReplayInput[] = [];
  let forcing = false,
    recovered = false;
  while (state.status === "running") {
    if (
      !forcing &&
      !recovered &&
      state.highest >= 13 &&
      state.brokenAt[13] >= 0
    )
      forcing = true;
    const beforeLives = state.lives;
    const action: string | null = forcing
      ? state.right
        ? "RIGHT_UP"
        : !state.left
          ? "LEFT_DOWN"
          : null
      : chooseHopAction(state);
    if (action) {
      assert.equal(applyCoreInput(core, state, action, target), true);
      inputs.push({ seq: inputs.length, tick: state.tick, action });
    }
    stepCore(core, state, target);
    if (forcing && state.lives < beforeLives) {
      forcing = false;
      recovered = true;
      assert.equal(state.checkpoint, 10);
      assert.equal(state.highest, 13);
      assert.equal(state.collected[13], true);
      assert.equal(state.brokenAt[13], -1);
      assert.equal(
        state.enemyContacts,
        0,
        "fall and alien damage cannot stack in one recovery tick",
      );
    }
  }
  assert.equal(recovered, true);
  assert.equal(state.status, "won");
  assert.deepEqual(
    replayCore(core, inputs, state.tick, seed, target).state,
    state,
  );
}

function contactState(): SkyHopV3State {
  const state = core.create("sentry-contact-boundary"),
    enemy = state.enemies[0];
  state.tick = 200;
  state.x = hopEnemyX(state, enemy, 201);
  state.y = enemy.y;
  state.vy = -73;
  state.camera = Math.min(0, enemy.y - 260000);
  state.enemyArmedAt[0] = 1;
  return state;
}
const contact = contactState();
contact.highest = contact.height = 16;
contact.checkpoint = 10;
contact.collected[13] = true;
contact.brokenAt[13] = 180;
contact.score = 1000;
contact.left = true;
contact.enemyDefeatedAt[1] = 100;
stepCore(core, contact, target);
assert.equal(contact.enemyContacts, 1);
assert.equal(contact.lives, 2);
assert.equal(contact.tick, 201, "V2 integrator is never run twice");
assert.equal(contact.highest, 16);
assert.equal(contact.height, 16);
assert.equal(contact.collected[13], true);
assert.equal(contact.brokenAt[13], -1);
assert.equal(contact.enemyDefeatedAt[1], 100);
assert.equal(
  contact.left,
  true,
  "held inputs survive recovery just as in V1/V2",
);
assert.equal(contact.lastEnemyHitIndex, 0);
assert.equal(contact.respawnUntil, 291);
assert.equal(contact.score, 650);

const warning = contactState();
warning.enemyArmedAt[0] = -1;
const warningEnemy = warning.enemies[0];
for (let tick = 201; tick <= 321; tick++) {
  warning.x = hopEnemyX(warning, warningEnemy, tick);
  warning.y = warningEnemy.y;
  warning.vy = -73;
  stepCore(core, warning, target);
  if (tick === 201) assert.equal(warning.enemyArmedAt[0], 321);
  assert.equal(
    warning.enemyContacts,
    tick < 321 ? 0 : 1,
    "120 complete simulation ticks of warning precede first contact",
  );
}
const shield = contactState();
shield.respawnUntil = 291;
shield.enemyArmedAt[0] = -1;
for (let tick = 201; tick <= 291; tick++) {
  shield.x = hopEnemyX(shield, shield.enemies[0], tick);
  shield.y = shield.enemies[0].y;
  shield.vy = -73;
  stepCore(core, shield, target);
  assert.equal(shield.enemyContacts, 0);
  assert.equal(
    shield.enemyArmedAt[0],
    tick < 291 ? -1 : 411,
    "warning restarts only after the full recovery grace",
  );
}
for (const [offset, visible] of [
  [39999, false],
  [40000, true],
  [580000, true],
  [580001, false],
] as const) {
  const state = contactState(),
    enemy = state.enemies[0];
  state.camera = enemy.y - offset;
  assert.equal(hopEnemyVisible(state, enemy), visible);
  assert.equal(hopEnemyActive(state, 0), visible);
}
const invisible = contactState();
invisible.camera = invisible.enemies[0].y - 581000;
stepCore(core, invisible, target);
assert.equal(
  invisible.enemyContacts,
  0,
  "no hidden contact below the fixed logical FOV",
);

const stomp = contactState(),
  sentry = stomp.enemies[0],
  top = sentry.y - rules.halfHeight;
stomp.y = top - SKY_HOP_RULES.halfHeight - 500;
stomp.vy = 1000;
stepCore(core, stomp, target);
assert.equal(stomp.stomps, 1);
assert.equal(stomp.enemyContacts, 0);
assert.equal(stomp.y, top - SKY_HOP_RULES.halfHeight);
assert.equal(stomp.vy, -4300);
assert.equal(stomp.enemyDefeatedAt[0], 201);
const scoreBefore = stomp.score;
stomp.x = hopEnemyX(stomp, sentry, 202);
stomp.y = sentry.y;
stomp.vy = -73;
stepCore(core, stomp, target);
assert.equal(stomp.stomps, 1);
assert.equal(stomp.enemyContacts, 0);
assert.equal(stomp.score, scoreBefore);
// A defeated enemy remains defeated through an ordinary checkpoint fall.
stomp.y = stomp.camera + 700000;
stepCore(core, stomp, target);
assert.equal(stomp.enemyDefeatedAt[0], 201);
assert.equal(stomp.lives, 2);

for (const [gap, hit] of [
  [26000, false],
  [25999, true],
] as const) {
  const state = contactState();
  state.x += gap;
  stepCore(core, state, target);
  assert.equal(
    state.enemyContacts > 0,
    hit,
    "exact horizontal tangency is clear; true overlap hits",
  );
}
for (const [gap, hit] of [
  [32000, false],
  [31999, true],
] as const) {
  const state = contactState();
  state.y += gap;
  stepCore(core, state, target);
  assert.equal(
    state.enemyContacts > 0,
    hit,
    "exact vertical tangency is clear; true overlap hits",
  );
}
const platformFirst = contactState(),
  support = platformFirst.platforms[platformFirst.enemies[0].platform];
platformFirst.x =
  hopPlatformX(support, 201) +
  (platformFirst.enemies[0].side < 0 ? -14000 : support.width + 14000);
platformFirst.y = support.y - 19500;
platformFirst.vy = 1000;
stepCore(core, platformFirst, target);
assert.equal(platformFirst.highest, platformFirst.enemies[0].platform);
assert.equal(platformFirst.y, support.y - 19000);
assert.equal(
  platformFirst.enemyContacts,
  0,
  "support overlap lands before the lower sentry can interact",
);
const terminal = contactState();
terminal.lives = 1;
stepCore(core, terminal, target);
assert.equal(terminal.status, "failed");
assert.equal(terminal.failure, "ALIEN_CONTACT");
assert.equal(terminal.enemyContacts, 1);
assert.equal(terminal.lives, 0);
const held = core.create("sky-v3-held");
assert.equal(applyCoreInput(core, held, "LEFT_UP", target), false);
assert.equal(applyCoreInput(core, held, "LEFT_DOWN", target), true);
assert.equal(applyCoreInput(core, held, "LEFT_DOWN", target), false);
assert.equal(applyCoreInput(core, held, "RIGHT_DOWN", target), true);
for (let tick = 0; tick < 20; tick++) stepCore(core, held, target);
assert.equal(held.vx, 0);
const idle = core.create("sky-v3-idle");
while (idle.status === "running") stepCore(core, idle, target);
assert.equal(idle.status, "failed");
assert.equal(replayCore(core, [], idle.tick, idle.seed, target).valid, true);
assert.equal(
  replayCore(
    core,
    [{ seq: 0, tick: 0, action: "LEFT_UP" }],
    idle.tick,
    idle.seed,
    target,
  ).error,
  "ACTION_NOT_AVAILABLE",
);
console.log(
  "Sky V3: natural stomp, hostile crumble recovery, contact loss, fall recovery, grace/rearm, exact contacts, optional rescue and antifarming all replayed",
);
