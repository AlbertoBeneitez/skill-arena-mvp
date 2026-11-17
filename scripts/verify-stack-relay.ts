import assert from "node:assert/strict";
import { STACK_3D_CORE } from "../lib/verified/precisionStackCore.v4";
import { STACK_RELAY_CORE, STACK_RELAY_RULES_V1, checkRelayTurn, rebuildRelay, relayLeaseMs, relayPlayedInRealTime, type RelayInput } from "../lib/verified/stackRelay.v1";
import { playRelayTurn } from "./stack-relay-player";

const seed = "relay:test-seed";
// Same physics as Stack 4.0.0; only the relay's time and input budget differ.
assert.equal(STACK_RELAY_CORE.gameVersion, STACK_3D_CORE.gameVersion);
assert.equal(STACK_RELAY_CORE.step, STACK_3D_CORE.step);
assert.ok(STACK_RELAY_CORE.maxFinalTick > STACK_3D_CORE.maxFinalTick);
assert.equal(relayLeaseMs(5), 135_000);
// Turn 1: five blocks, closing exactly as the sixth appears.
let committed: RelayInput[] = [], tick = 0, height = 0;
for (let turn = 1; turn <= 3; turn++) {
  const t = playRelayTurn(seed, committed, tick, 5, { wait: turn * 7 });
  const check = checkRelayTurn({ seed, committed, committedFinalTick: tick, blocksPerTurn: 5, turnInputs: t.inputs, finalTick: t.finalTick });
  assert.ok(check.ok, JSON.stringify(check));
  if (!check.ok) throw new Error();
  assert.equal(check.placed, 5);
  assert.equal(check.ended, false);
  assert.equal(check.state.height, height + 5);
  committed = check.inputs; tick = t.finalTick; height = check.state.height;
}
// The tower rebuilt from the log is the same tower.
const rebuilt = rebuildRelay(seed, committed, tick);
assert.ok(rebuilt.ok && rebuilt.state.height === 15 && rebuilt.state.phase === "moving" && rebuilt.state.movingAgeTicks === 0);
// Refusals.
const next = playRelayTurn(seed, committed, tick, 5);
const base = { seed, committed, committedFinalTick: tick, blocksPerTurn: 5 };
assert.deepEqual(checkRelayTurn({ ...base, turnInputs: [], finalTick: tick + 10 }), { ok: false, error: "EMPTY_TURN" });
assert.deepEqual(checkRelayTurn({ ...base, turnInputs: [{ tick: tick - 1, action: "DROP" }], finalTick: next.finalTick }), { ok: false, error: "INPUT_BEFORE_TURN" }, "no drop in the previous player's time");
assert.equal((checkRelayTurn({ ...base, turnInputs: next.inputs.slice(0, 4), finalTick: next.finalTick }) as { error: string }).error !== undefined, true, "four drops are not a five-block turn");
assert.deepEqual(checkRelayTurn({ ...base, turnInputs: next.inputs, finalTick: next.finalTick + 1 }), { ok: false, error: "TURN_END_NOT_AT_HANDOVER" }, "the turn closes as the next block appears");
assert.deepEqual(checkRelayTurn({ ...base, turnInputs: next.inputs, finalTick: next.finalTick - 30 }).ok, false);
const six = playRelayTurn(seed, committed, tick, 6);
assert.deepEqual(checkRelayTurn({ ...base, turnInputs: six.inputs, finalTick: six.finalTick }), { ok: false, error: "TOO_MANY_DROPS" });
assert.deepEqual(checkRelayTurn({ ...base, blocksPerTurn: 4, turnInputs: next.inputs, finalTick: next.finalTick }), { ok: false, error: "INVALID_BLOCKS_PER_TURN" });
assert.deepEqual(checkRelayTurn({ ...base, turnInputs: [{ tick: next.inputs[0].tick, action: "JUMP" as "DROP" }], finalTick: next.finalTick }), { ok: false, error: "INVALID_INPUT" });
// (The committed log never travels from the browser: the server keeps it and replays it for every turn.)
// A turn can end the relay: one block, then the run idles out.
const last = playRelayTurn(seed, committed, tick, 5, { idleAfter: 1 });
const end = checkRelayTurn({ ...base, turnInputs: last.inputs, finalTick: last.finalTick });
assert.ok(end.ok && end.ended && end.placed === 1 && end.state.failure === "TIMEOUT_IDLE");
if (end.ok) assert.deepEqual(checkRelayTurn({ seed, committed: end.inputs, committedFinalTick: last.finalTick, blocksPerTurn: 5, turnInputs: [{ tick: last.finalTick, action: "DROP" }], finalTick: last.finalTick + 1 }), { ok: false, error: "RELAY_ENDED" });
// Real time: a turn of 10 s of play needs at least 8 s on the clock.
assert.equal(relayPlayedInRealTime(1200, 8_000), true);
assert.equal(relayPlayedInRealTime(1200, 7_900), false);
assert.equal(STACK_RELAY_RULES_V1.blocksPerTurnOptions.join(","), "3,5,10");
console.log(`Stack relay v1 OK · 3 turns of 5 → tower 15, exact handover, refusals (early drop, unfinished, extra drop, bad action), end by idling, real-time check`);
