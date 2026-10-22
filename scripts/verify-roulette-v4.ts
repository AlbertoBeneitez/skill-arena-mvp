import assert from "node:assert/strict";
import {
  ROULETTE_CORE_V4 as core,
  ROULETTE_RULES_V4 as rules,
} from "../lib/verified/galacticRouletteCore.v4";
import { ROULETTE_CORE_V3 } from "../lib/verified/galacticRouletteCore.v3";
import { applyCoreInput, stepCore } from "../lib/verified/coreRuntime.v1";
import {
  createMatchManifest,
  issueAttemptTicket,
  processAttemptRecord,
} from "../lib/server/verifiedMatch";
import { verifyCoreFixture } from "./core-test-utils";
import fixture from "./fixtures/roulette-v4.json" with { type: "json" };

verifyCoreFixture(core, fixture.seed, fixture.inputs, fixture.finalTick, 1e9, {
  score: fixture.score,
  status: "won",
  failure: null,
  hash: fixture.hash,
});

// Historical versions stay registered and unchanged.
assert.equal(ROULETTE_CORE_V3.gameVersion, "3.0.0");
assert.equal(core.gameVersion, "4.0.0");

// Server replay accepts a V4 record end to end and rejects a tampered seed.
{
  const manifest = createMatchManifest({ gameId: core.gameId, gameVersion: core.gameVersion, seed: fixture.seed, targetScore: 1e9 });
  const ticket = issueAttemptTicket({ manifest, playerId: "roulette-v4-player" });
  const payload = { manifest, ticket, inputs: fixture.inputs, final_tick: fixture.finalTick };
  const now = Date.now;
  try {
    Date.now = () => Date.parse(ticket.issued_at) + (fixture.finalTick * 1000) / 120 + 1000;
    const checked = processAttemptRecord({ ...payload, score: 999999999 });
    assert.equal(checked.body.verified, true);
    assert.equal(checked.body.score, fixture.score);
    assert.equal(processAttemptRecord({ ...payload, manifest: { ...manifest, seed: "tampered" } }).body.verified, false);
  } finally {
    Date.now = now;
  }
}

// The solid outer wall always returns an outward-moving ball to the bowl.
for (const angle of [0, 1, 2, 3]) {
  const s = core.create(`wall-${angle}`);
  const vx = [900, -900, 0, 0][angle], vy = [0, 0, 900, -900][angle];
  Object.assign(s, {
    ballX: 195000 + (vx > 0 ? 147500 : vx < 0 ? -147500 : 0),
    ballY: 195000 + (vy > 0 ? 147500 : vy < 0 ? -147500 : 0),
    ballZ: 30000, ballVx: vx, ballVy: vy, ballVz: 0,
    inBowl: true, flightStart: 0, landingTick: 960,
  });
  for (let t = 0; t < 4; t++) stepCore(core, s, 1e9);
  const radius = Math.hypot(s.ballX - 195000, s.ballY - 195000);
  assert.ok(radius <= rules.wallRadius + 1, `wall holds the ball (${radius})`);
  assert.ok(vx ? vx * (s.ballX - 195000) > 0 ? s.ballVx * vx < 0 : s.ballVx * vx < 0 : s.ballVy * vy < 0, "wall reverses the outward velocity");
  assert.ok(s.contacts >= 1);
}

// A good toss bounces for a while and then rides the wheel into one pocket.
let settled = 0;
for (let seed = 0; seed < 24; seed++) {
  const s = core.create(`natural-${seed}`);
  assert.equal(applyCoreInput(core, s, "TOSS_D20_P08", 1e9), true);
  let wallContacts = 0, previous = s.contacts;
  for (let t = 0; t < rules.maximumFlightTicks && s.landingTick !== -1; t++) {
    stepCore(core, s, 1e9);
    if (s.contacts > previous + 1) wallContacts++;
    previous = s.contacts;
  }
  assert.equal(s.landingTick, -1, "toss always resolves");
  assert.equal(s.lastMiss, false);
  const age = s.tick - s.flightStart;
  assert.ok(age >= rules.minimumFlightTicks, `no instant stop (${age})`);
  assert.ok(age < rules.maximumFlightTicks, `captured by the wheel before the timeout (${age})`);
  assert.ok(s.lastNumber !== null);
  assert.ok([s.ballX, s.ballY, s.ballZ, s.ballVx, s.ballVy, s.ballVz].every(Number.isSafeInteger));
  settled++;
}
assert.equal(settled, 24);

// Deterministic across repeated runs.
const run = () => {
  const s = core.create("repeat");
  applyCoreInput(core, s, "TOSS_D21_P09", 1e9);
  for (let t = 0; t < rules.maximumFlightTicks && s.landingTick !== -1; t++) stepCore(core, s, 1e9);
  return JSON.stringify(s);
};
assert.equal(run(), run());
// The toss window must fit the match clock.
const late = core.create("late");
late.tick = 21600 - rules.maximumFlightTicks + 1;
assert.equal(core.canApply(late, "TOSS_D20_P08"), false);
console.log("roulette-v4 OK");
