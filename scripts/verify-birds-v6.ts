import assert from "node:assert/strict";
import {
  BIRDS_CORE_V6 as core,
  BIRDS_STOCK_V6,
  birdsFieldV6,
  unsupportedDirection,
} from "../lib/verified/galacticBirdsCore.v6";
import { BIRDS_CORE as BIRDS_CORE_V4 } from "../lib/verified/galacticBirdsCore.v4";
import { BIRDS_CORE_V5 } from "../lib/verified/galacticBirdsCore.v5";
import { applyCoreInput, stepCore, replayCore } from "../lib/verified/coreRuntime.v1";
import { createMatchManifest, issueAttemptTicket, processAttemptRecord } from "../lib/server/verifiedMatch";
import { verifyCoreFixture } from "./core-test-utils";
import fixture from "./fixtures/birds-v6.json" with { type: "json" };

verifyCoreFixture(core, fixture.seed, fixture.inputs, fixture.finalTick, 1e9, { ...fixture, status: "won" });

// Historical versions are untouched and still registered with their own versions.
assert.equal(BIRDS_CORE_V4.gameVersion, "4.0.0");
assert.equal(BIRDS_CORE_V5.gameVersion, "5.0.0");
assert.equal(core.gameVersion, "6.0.0");
assert.equal(core.inputVersion, 2);

// Every level, many seeds: separate pieces, inside the fixed screen, stable and
// with both pigs alive after five seconds of rest.
const sizes: number[] = [];
for (let level = 0; level < 6; level++) {
  for (let seed = 0; seed < 24; seed++) {
    const s = core.create(`v6-static-${seed}`);
    Object.assign(s, birdsFieldV6(`v6-static-${seed}`, level), { level });
    assert.equal(s.enemies.length, 2);
    assert.ok(s.bodies.length >= 7, `level ${level} has enough pieces`);
    assert.ok(s.bodies.every((b) => b.x - b.w / 2 >= 175000 && b.x + b.w / 2 <= 388000), `level ${level} inside the screen`);
    assert.ok(new Set(s.bodies.map((b) => b.material)).size >= 2, `level ${level} mixes materials`);
    const start = s.bodies.map((b) => [b.x, b.y]);
    for (let t = 0; t < 600; t++) stepCore(core, s, 1e9);
    assert.equal(s.kills, 0, `spontaneous kill L${level} seed ${seed}`);
    assert.ok(s.bodies.every((b) => b.alive), `spontaneous destruction L${level} seed ${seed}`);
    s.bodies.forEach((b, i) => assert.ok(Math.abs(b.x - start[i][0]) < 3000 && Math.abs(b.y - start[i][1]) < 3000, `settles in place L${level}`));
    assert.ok(s.bodies.every((b) => [b.x, b.y, b.vx, b.vy, b.hp].every(Number.isSafeInteger)));
    if (seed === 0) sizes.push(s.bodies.length);
  }
}
assert.ok(sizes[5] >= sizes[0], "the last level is not smaller than the first");
const shapes = new Set(Array.from({ length: 6 }, (_, level) => JSON.stringify(birdsFieldV6("shape", level).bodies.map((b) => [b.w, b.h]))));
assert.equal(shapes.size, 6, "six different silhouettes");

// Support stability: a plank whose centre of mass is past its only support slides
// off and falls to the floor; the same plank over its support stays put.
{
  const make = (plankX: number) => {
    const s = core.create("support");
    s.bodies = [
      { id: 0, x: 260000, y: 560000 - 30000, w: 40000, h: 60000, vx: 0, vy: 0, hp: 70, maxHp: 70, material: "ceramic", alive: true },
      { id: 1, x: plankX, y: 560000 - 60000 - 6000, w: 100000, h: 12000, vx: 0, vy: 0, hp: 70, maxHp: 70, material: "ceramic", alive: true },
    ];
    s.enemies = [];
    return s;
  };
  const stable = make(260000 + 15000);
  assert.equal(unsupportedDirection(stable.bodies, stable.bodies[1]), 0, "centre of mass over the support");
  for (let t = 0; t < 600; t++) stepCore(core, stable, 1e9);
  assert.ok(Math.abs(stable.bodies[1].y - (560000 - 66000)) < 2000, "supported plank stays up");
  const overhang = make(260000 + 24000);
  assert.equal(unsupportedDirection(overhang.bodies, overhang.bodies[1]), 1, "minimal overhang is unsupported");
  for (let t = 0; t < 900; t++) stepCore(core, overhang, 1e9);
  const plank = overhang.bodies[1];
  assert.ok(plank.y + plank.h / 2 >= 559000 - 2000 || !plank.alive, "unsupported plank falls to the floor");
  assert.ok(plank.x > 260000 + 24000, "and slides away from the support");
}

// Bird choice: a replayable, limited stock.
{
  const s = core.create("choice");
  assert.deepEqual(s.stock, BIRDS_STOCK_V6);
  assert.equal(s.ammo, 30);
  assert.equal(s.selected, "scout");
  assert.equal(applyCoreInput(core, s, "BIRD_METEOR", 1e9), true);
  assert.equal(s.selected, "meteor");
  assert.equal(applyCoreInput(core, s, "SHOOT", 1e9), true);
  assert.equal(s.bird?.kind, "meteor");
  assert.equal(s.stock.meteor, BIRDS_STOCK_V6.meteor - 1);
  assert.equal(s.ammo, 29);
  assert.equal(core.canApply(s, "BIRD_DART"), false, "no switching while a bird is in flight");
  // Exhausting a type blocks it and moves the selection to one that is left.
  const t = core.create("exhaust");
  t.stock.dart = 0;
  t.ammo = t.stock.scout + t.stock.meteor;
  assert.equal(core.canApply(t, "BIRD_DART"), false);
  t.selected = "dart";
  assert.equal(core.canApply(t, "SHOOT"), false);
  t.selected = "meteor";
  t.stock.meteor = 1;
  t.ammo = t.stock.scout + 1;
  assert.equal(applyCoreInput(core, t, "SHOOT", 1e9), true);
  assert.equal(t.stock.meteor, 0);
  for (let i = 0; i < 2000 && t.phase !== "aim" && t.status === "running"; i++) stepCore(core, t, 1e9);
  if (t.status === "running") assert.notEqual(t.selected, "meteor", "selection moves to a type with stock");
  // Unknown actions are refused by the replay.
  assert.equal(replayCore(core, [{ seq: 0, tick: 0, action: "BIRD_UNKNOWN" }], 10, "x", 1e9).error, "INVALID_INPUT");
}

// A server record is accepted for V6 and rejected when the seed is tampered with.
{
  const manifest = createMatchManifest({ gameId: core.gameId, gameVersion: core.gameVersion, seed: fixture.seed, targetScore: 1e9 });
  const ticket = issueAttemptTicket({ manifest, playerId: "birds-v6-player" });
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
console.log("birds-v6 OK");
