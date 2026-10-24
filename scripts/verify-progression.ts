import assert from "node:assert/strict";
import { applyChest, applyRun, claimMission, equip, evaluateRun, initialProgress, levelOf, parseProgress, rollChest, rollDay, xpToNext } from "../lib/progression";

const d1 = "2026-10-24", d2 = "2026-10-25", d4 = "2026-10-27";
// XP curve is monotonic and levelOf inverts it.
let total = 0;
for (let l = 1; l < 12; l++) {
  assert.equal(levelOf(total).level, l);
  assert.equal(levelOf(total + xpToNext(l) - 1).level, l);
  total += xpToNext(l);
}
assert.equal(levelOf(total).level, 12);

// Risk rules.
const s0 = initialProgress(d1);
const calm = evaluateRun(s0, { gameId: "darts", score: 100, won: false, risk: "calm" });
assert.equal(calm.met, true); assert.equal(calm.multiplier, 1);
const boldMiss = evaluateRun(s0, { gameId: "darts", score: 100, won: false, risk: "bold" });
assert.equal(boldMiss.met, false); assert.ok(boldMiss.xpGain < calm.xpGain);
const boldHit = evaluateRun(s0, { gameId: "darts", score: 100, won: true, risk: "bold" });
assert.equal(boldHit.met, true); assert.ok(boldHit.xpGain > calm.xpGain * 2 - 1);
// Legend needs target + beating an existing personal best.
const first = applyRun(s0, { gameId: "darts", score: 100, won: true, risk: "legend" }, d1);
assert.equal(first.outcome.met, false, "no previous best => legend cannot be met");
assert.equal(first.state.bests.darts, 100);
const beat = applyRun(first.state, { gameId: "darts", score: 150, won: true, risk: "legend" }, d1);
assert.equal(beat.outcome.met, true); assert.equal(beat.outcome.multiplier, 3);
const worse = applyRun(beat.state, { gameId: "darts", score: 120, won: true, risk: "legend" }, d1);
assert.equal(worse.outcome.met, false);
assert.equal(worse.state.bests.darts, 150);

// Missions, streak and day roll.
let s = initialProgress(d1);
s = applyRun(s, { gameId: "a", score: 1, won: true, risk: "calm" }, d1).state;
s = applyRun(s, { gameId: "b", score: 1, won: true, risk: "legend" }, d1).state;
const third = applyRun(s, { gameId: "c", score: 1, won: false, risk: "calm" }, d1);
assert.deepEqual(third.missionsDone.sort(), ["variety3"]);
s = third.state;
assert.equal(s.missions.find((m) => m.id === "wins2")!.progress, 2);
assert.equal(s.missions.find((m) => m.id === "legend1")!.progress, 1);
const claimed = claimMission(s, "legend1");
assert.equal(claimed.stars, s.stars + 80);
assert.equal(claimMission(claimed, "legend1"), claimed, "double claim ignored");
assert.equal(claimMission(initialProgress(d1), "wins2").stars, 0, "unfinished mission cannot be claimed");
assert.equal(s.streak, 1);
assert.equal(applyRun(s, { gameId: "a", score: 1, won: true, risk: "calm" }, d2).state.streak, 2);
assert.equal(rollDay(s, d4).streak, 0, "gap breaks the streak");
assert.equal(rollDay(s, d4).missions.every((m) => m.progress === 0), true);

// Chest: deterministic per seed, never repeats a cosmetic, applies cleanly, fewer rewards when the risk failed.
for (let i = 0; i < 50; i++) {
  const a = rollChest(`seed-${i}`, [], true), b = rollChest(`seed-${i}`, [], true);
  assert.deepEqual(a, b); assert.equal(a.length, 3);
  const ids = a.filter((c) => c.kind === "cosmetic").map((c) => c.cosmeticId);
  assert.equal(new Set(ids).size, ids.length);
}
let dustMet = 0, dustMiss = 0;
for (let i = 0; i < 400; i++) {
  dustMet += rollChest(`c${i}`, [], true).filter((c) => c.kind === "dust").length;
  dustMiss += rollChest(`c${i}`, [], false).filter((c) => c.kind === "dust").length;
}
assert.ok(dustMiss > dustMet * 1.8, `misses should draw dust more often (${dustMiss} vs ${dustMet})`);
const cosmetic = { kind: "cosmetic" as const, amount: 0, cosmeticId: "frame-gold", label: "x", icon: "x" };
const withFrame = applyChest(initialProgress(d1), cosmetic);
assert.equal(withFrame.frame, "frame-gold");
assert.deepEqual(applyChest(withFrame, cosmetic).unlocked, ["frame-gold"]);
assert.equal(equip(withFrame, "frame-gold").frame, "", "equip toggles");
assert.equal(equip(initialProgress(d1), "frame-gold").frame, "", "cannot equip locked items");
assert.equal(rollChest("all", ["frame-cyan", "frame-gold", "frame-magenta", "frame-lime", "theme-nebula", "theme-solar", "theme-aurora"], true).every((c) => c.kind !== "cosmetic"), true);

// Persistence parsing is tolerant.
assert.equal(parseProgress("not json", d1).xp, 0);
assert.equal(parseProgress(JSON.stringify(s), d1).bests.a, 1);
console.log("Progression OK · XP curve, risk rules, missions, streak, chest odds, cosmetics, persistence");
