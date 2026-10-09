import assert from "node:assert/strict";
import {
  MAZE_CORE_V2 as core,
  MAZE_V2_RULES,
  buildMazeBoardV2,
  mazeEnemyAwakeV2,
  mazeEnemyPreparingV2,
  mazeEnemyPeriodV2,
  mazeMovePeriodV2,
} from "../lib/verified/mazeRushCore.v2";
import { mazeDistances, mazeNeighbor } from "../lib/verified/mazeRushCore.v1";
import { generateScenario } from "../lib/server/scenarios";
import {
  applyCoreInput,
  replayCore,
  stepCore,
} from "../lib/verified/coreRuntime.v1";
import type { ReplayInput } from "../lib/verified/inputValidation";
import { verifyCoreFixture } from "./core-test-utils";
import { chooseMazeActionV2 } from "./maze-v2-play-fixture";
import fixture from "./fixtures/maze-v2.json" with { type: "json" };

verifyCoreFixture(core, fixture.seed, fixture.inputs, fixture.finalTick, 1e6, {
  score: fixture.score,
  status: "won",
  failure: null,
  hash: fixture.hash,
});

let observedBothPursuers = false;
for (let i = 0; i < 32; i++) {
  const seed = generateScenario(
      { game_id: core.gameId, game_version: core.gameVersion },
      i,
    ).seed,
    state = core.create(seed),
    board = state.board,
    walls = [...board.walls],
    total = board.total,
    inputs: ReplayInput[] = [];
  assert.equal("sector" in state, false);
  assert.equal("clearUntil" in state, false);
  // Half the real replays begin later, exercising both pursuers rather than
  // proving only an expert route that clears before the second activation.
  if (i % 2) while (state.tick < 2400) stepCore(core, state, 1e6);
  while (state.status === "running") {
    observedBothPursuers ||=
      mazeEnemyAwakeV2(state, 0) && mazeEnemyAwakeV2(state, 1);
    const action = chooseMazeActionV2(state);
    if (action && core.canApply(state, action)) {
      inputs.push({ seq: inputs.length, tick: state.tick, action });
      assert.equal(applyCoreInput(core, state, action, 1e6), true);
    }
    const before = state.player;
    stepCore(core, state, 1e6);
    assert.equal(state.board, board, "one existing board throughout the run");
    assert.equal(state.board.total, total);
    assert.ok(
      state.player === before ||
        core.actions
          .slice(0, 4)
          .some((a) => mazeNeighbor(board, before, a) === state.player),
      "no player teleport, including damage and final collection",
    );
    if (state.tick < MAZE_V2_RULES.firstPursuerTicks)
      assert.equal(state.lives, 3, "generous safe opening");
  }
  assert.equal(state.status, "won", `complete continuous course ${i}`);
  assert.equal(state.collected, total);
  assert.equal(state.board.nodes.some(Boolean), false);
  assert.deepEqual(
    state.board.walls,
    walls,
    "corridors never change under the player",
  );
  assert.deepEqual(
    replayCore(core, inputs, state.tick, seed, 1e6).state,
    state,
  );
  assert.ok(inputs.length < core.maxInputs);
  console.log(
    `Maze V2 course ${i}: ${state.tick} ticks, ${state.score} points, ${state.lives} shields`,
  );
}
assert.equal(
  observedBothPursuers,
  true,
  "complete courses exercise both late pursuers",
);

for (let i = 0; i < 128; i++) {
  const board = buildMazeBoardV2(`maze-v2-board-${i}`),
    distances = mazeDistances(board, board.start);
  assert.equal(board.width, 11);
  assert.equal(board.height, 13);
  assert.equal(board.walls[board.start], false);
  assert.ok(board.walls.every((wall, cell) => wall || distances[cell] >= 0));
  assert.equal(board.enemies.length, 2);
  assert.equal(board.pulses.filter(Boolean).length, 3);
  assert.ok(board.pulses.every((pulse, cell) => !pulse || board.nodes[cell]));
}

const idle = core.create("maze-v2-idle");
while (idle.status === "running") stepCore(core, idle, 1e6);
assert.equal(idle.failure, "TIME_LIMIT");
assert.equal(idle.lives, 3);
assert.equal(idle.player, idle.board.start);
assert.equal(idle.collected, 0);
assert.equal(replayCore(core, [], idle.tick, "maze-v2-idle", 1e6).valid, true);

const activation = core.create("maze-v2-activation");
activation.tick = MAZE_V2_RULES.firstPursuerTicks - 1;
activation.collected = MAZE_V2_RULES.firstPursuerNodes - 1;
stepCore(core, activation, 1e6);
assert.equal(mazeEnemyAwakeV2(activation, 0), false);
assert.equal(
  activation.enemyReadyAt[0],
  null,
  "both time and progress are required",
);
activation.collected++;
stepCore(core, activation, 1e6);
const firstReadyAt = activation.tick + MAZE_V2_RULES.armingTicks;
assert.equal(activation.enemyReadyAt[0], firstReadyAt);
assert.equal(mazeEnemyPreparingV2(activation, 0), true);
assert.equal(mazeEnemyAwakeV2(activation, 0), false);
while (activation.tick < firstReadyAt) stepCore(core, activation, 1e6);
assert.equal(mazeEnemyAwakeV2(activation, 0), true);
assert.equal(mazeEnemyPreparingV2(activation, 0), false);
assert.equal(activation.enemyReadyAt[0], firstReadyAt, "arming happens once");
assert.equal(mazeEnemyAwakeV2(activation, 1), false);
activation.collected = MAZE_V2_RULES.secondPursuerNodes;
activation.tick = MAZE_V2_RULES.secondPursuerTicks - 1;
assert.equal(mazeEnemyAwakeV2(activation, 1), false);
stepCore(core, activation, 1e6);
assert.equal(mazeEnemyAwakeV2(activation, 1), false);
assert.equal(mazeEnemyPreparingV2(activation, 1), true);
const secondReadyAt = activation.enemyReadyAt[1]!;
assert.equal(secondReadyAt, activation.tick + MAZE_V2_RULES.armingTicks);
while (activation.tick < secondReadyAt) stepCore(core, activation, 1e6);
assert.equal(mazeEnemyAwakeV2(activation, 1), true);
let playerPeriod = 24,
  enemyPeriod = 84;
for (let collected = 0; collected <= activation.board.total; collected++) {
  activation.collected = collected;
  const nextPlayerPeriod = mazeMovePeriodV2(activation),
    nextEnemyPeriod = mazeEnemyPeriodV2(activation);
  assert.ok(nextPlayerPeriod <= playerPeriod && nextPlayerPeriod >= 20);
  assert.ok(nextEnemyPeriod <= enemyPeriod && nextEnemyPeriod >= 60);
  playerPeriod = nextPlayerPeriod;
  enemyPeriod = nextEnemyPeriod;
}

const buffered = core.create("maze-v2-buffered"),
  action = core.actions
    .slice(0, 4)
    .find(
      (a) =>
        mazeNeighbor(buffered.board, buffered.player, a) !== buffered.player,
    )!;
assert.equal(applyCoreInput(core, buffered, action, 1e6), true);
assert.equal(
  applyCoreInput(core, buffered, action, 1e6),
  false,
  "duplicate action rejected",
);
assert.equal(
  applyCoreInput(core, buffered, "STOP", 1e6),
  false,
  "cooldown enforced",
);
const start = buffered.player;
for (let tick = 0; tick < MAZE_V2_RULES.initialReadyTicks; tick++)
  stepCore(core, buffered, 1e6);
assert.notEqual(
  buffered.player,
  start,
  "first buffered input moves when ready",
);
assert.equal(buffered.collected, 1);
const once = buffered.score;
assert.equal(applyCoreInput(core, buffered, "STOP", 1e6), true);
const stopped = buffered.player;
for (let tick = 0; tick < 50; tick++) stepCore(core, buffered, 1e6);
assert.equal(buffered.player, stopped);
assert.ok(
  buffered.tick > MAZE_V2_RULES.initialReadyTicks,
  "STOP never pauses authority",
);
const reverse = (
  { UP: "DOWN", DOWN: "UP", LEFT: "RIGHT", RIGHT: "LEFT" } as Record<
    string,
    string
  >
)[action];
assert.equal(applyCoreInput(core, buffered, reverse, 1e6), true);
for (let tick = 0; tick < 24; tick++) stepCore(core, buffered, 1e6);
assert.equal(buffered.player, start);
assert.equal(applyCoreInput(core, buffered, action, 1e6), true);
for (let tick = 0; tick < 24; tick++) stepCore(core, buffered, 1e6);
assert.equal(buffered.collected, 1);
assert.equal(
  buffered.score,
  once,
  "returning to consumed nodes cannot farm score",
);

const lossSeed = "maze-v2-real-loss",
  loss = core.create(lossSeed),
  lossInputs: ReplayInput[] = [];
while (loss.status === "running") {
  const action = loss.collected >= 20 ? "STOP" : chooseMazeActionV2(loss);
  if (action && core.canApply(loss, action)) {
    lossInputs.push({ seq: lossInputs.length, tick: loss.tick, action });
    assert.equal(applyCoreInput(core, loss, action, 1e6), true);
  }
  const previous = loss.player;
  stepCore(core, loss, 1e6);
  if (action === "STOP")
    assert.equal(loss.player, previous, "hits do not reset a stopped player");
}
assert.equal(loss.failure, "PURSUER_COLLISION");
assert.equal(loss.lives, 0);
assert.deepEqual(
  replayCore(core, lossInputs, loss.tick, lossSeed, 1e6).state,
  loss,
);

function contactFixture(power = false) {
  const state = core.create("maze-v2-contact");
  state.tick = MAZE_V2_RULES.firstPursuerTicks;
  state.collected = MAZE_V2_RULES.firstPursuerNodes;
  state.nextMoveTick = 9999;
  state.nextEnemyTick = 9999;
  state.board.enemies[0].cell = state.player;
  state.enemyReadyAt[0] = 0;
  state.poweredUntil = power ? state.tick + 300 : 0;
  return state;
}
const hit = contactFixture(),
  player = hit.player;
stepCore(core, hit, 1e6);
assert.equal(hit.lives, 2);
assert.equal(hit.player, player, "damage does not restart or teleport");
assert.equal(hit.collected, MAZE_V2_RULES.firstPursuerNodes);
hit.board.enemies[0].dormantUntil = 0;
stepCore(core, hit, 1e6);
assert.equal(hit.lives, 2, "protection prevents double damage");
const powered = contactFixture(true);
stepCore(core, powered, 1e6);
assert.equal(powered.lives, 3);
assert.equal(powered.score, 0, "captured pursuers cannot farm score");
assert.ok(powered.board.enemies[0].dormantUntil > powered.tick);
const lethal = contactFixture();
lethal.lives = 1;
stepCore(core, lethal, 1e6);
assert.equal(lethal.failure, "PURSUER_COLLISION");
const swap = contactFixture();
swap.tick = 2640;
const neighbor = core.actions
  .slice(0, 4)
  .find((a) => mazeNeighbor(swap.board, swap.player, a) !== swap.player)!;
swap.direction = neighbor as typeof swap.direction;
swap.queued = swap.direction;
swap.nextMoveTick = swap.tick + 1;
swap.nextEnemyTick = swap.tick + 1;
swap.board.pulses[mazeNeighbor(swap.board, swap.player, neighbor)] = false;
swap.board.enemies[0].home = swap.player;
swap.board.enemies[0].cell = mazeNeighbor(swap.board, swap.player, neighbor);
// At this tick the pursuer patrols to its home, exchanging the player's tile.
stepCore(core, swap, 1e6);
assert.equal(swap.lives, 2, "edge swaps count as contacts");

// The player is adjacent to a sleeping pursuer at the exact activation gate.
// Before the warning this state lost a shield on the first newly-active tick.
const adjacent = core.create("activation-edge-review"),
  home = adjacent.board.enemies[0].home;
adjacent.player = core.actions
  .slice(0, 4)
  .map((a) => mazeNeighbor(adjacent.board, home, a))
  .find((cell) => cell !== home)!;
adjacent.previousPlayer = adjacent.player;
adjacent.tick = MAZE_V2_RULES.firstPursuerTicks - 1;
adjacent.collected = MAZE_V2_RULES.firstPursuerNodes;
adjacent.nextMoveTick = 9999;
stepCore(core, adjacent, 1e6);
assert.equal(
  adjacent.lives,
  3,
  "activation cannot damage before a visible warning",
);
assert.equal(mazeEnemyPreparingV2(adjacent, 0), true);
const warningEnds = adjacent.enemyReadyAt[0]!;
while (adjacent.tick < warningEnds - 1) {
  stepCore(core, adjacent, 1e6);
  assert.equal(adjacent.lives, 3);
  assert.equal(
    adjacent.board.enemies[0].cell,
    home,
    "arming pursuer cannot move",
  );
}
assert.equal(mazeEnemyPreparingV2(adjacent, 0), true);
stepCore(core, adjacent, 1e6);
assert.equal(
  adjacent.lives,
  2,
  "remaining next to the armed pursuer is a live contact",
);
assert.equal(
  adjacent.enemyReadyAt[0],
  warningEnds,
  "damage does not re-arm a level",
);
console.log(
  "Maze V2: golden/render/input, 32 full continuous courses, 128 connected boards, safe opening, individually warned pursuers, buffered turns/STOP, protection and overlap/edge-swap",
);
