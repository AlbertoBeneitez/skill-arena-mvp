/** v192 · Group against group: league by sum of positions, tournament two out per round until a group is empty.
 * v229 · Eliminatoria v2: five matchdays, victory points by place, one out per matchday, most points wins. */
import assert from "node:assert/strict";
import { createGroupVersus, ELIMINATORIA_ROUNDS, recordVersusScore, versusOutcome, versusPayouts, versusPoints, type GroupVersus, type VersusTeam } from "../lib/groupVersus";

const team = (id: string, n: number): VersusTeam => ({ id, name: id, players: Array.from({ length: n }, (_, i) => ({ id: `${id}${i + 1}`, name: `${id}${i + 1}`, avatar: "" })) });
const setup = { entryMinor: 500, gameIds: ["billiards"], lowerWinsGameIds: [] as string[], rounds: 2 };
/** Plays the current round with the given scores (missing players score 0). */
function playRound(v: GroupVersus, scores: Record<string, number>): GroupVersus {
  const round = Math.max(...v.comp.matches.map((m) => m.round));
  v.comp.matches.forEach((m, i) => {
    if (m.round !== round) return;
    for (const p of m.players) v = recordVersusScore(v, i, p, scores[p] ?? 0, 1000);
  });
  return v;
}

assert.throws(() => createGroupVersus("x", "league", team("A", 2), team("B", 3), setup), /same number/);
assert.throws(() => createGroupVersus("x", "league", team("A", 2), team("A", 2), setup), /itself/);

// League: positions of each group's members add up; the lower sum wins.
{
  let v = createGroupVersus("lg", "league", team("A", 2), team("B", 2), setup);
  assert.deepEqual(versusOutcome(v), { finished: false });
  v = playRound(v, { A1: 90, B1: 80, B2: 70, A2: 10 });
  v = playRound(v, { A1: 95, B1: 85, B2: 75, A2: 5 });
  const o = versusOutcome(v);
  assert.equal(o.finished, true);
  // Places: A1 1, B1 2, B2 3, A2 4 → A = 5, B = 5: equal sums, A has the best-placed player.
  assert.deepEqual(o.finished && o.sums, [5, 5]);
  assert.equal(o.finished && o.winner, "A");
  const pay = versusPayouts(v)!;
  assert.deepEqual(pay, { A1: 1000, A2: 1000, B1: 0, B2: 0 });
}
{
  let v = createGroupVersus("lg2", "league", team("A", 2), team("B", 2), setup);
  v = playRound(v, { B1: 90, B2: 80, A1: 70, A2: 10 });
  v = playRound(v, { B1: 90, B2: 80, A1: 70, A2: 10 });
  const o = versusOutcome(v);
  assert.equal(o.finished && o.winner, "B");
  assert.deepEqual(o.finished && o.sums, [7, 3]);
}

/** A tournament as saved before v229 (two out per round, no round limit, no points): stored states keep these rules. */
const legacy = (v: GroupVersus): GroupVersus => {
  const { rules: _rules, ...rest } = v;
  const { stopAfterRounds: _stop, ...config } = v.comp.config;
  return { ...rest, comp: { ...v.comp, config: { ...config, eliminatePerRound: 2 } } };
};
const tournament = (id: string, a: VersusTeam, b: VersusTeam, s: typeof setup) => legacy(createGroupVersus(id, "tournament", a, b, s));

// Tournament (v192 rules): the two worst of everyone go each round; it ends when a group has nobody left.
{
  let v = tournament("tn", team("A", 3), team("B", 3), setup);
  v = playRound(v, { A1: 100, A2: 90, B1: 80, A3: 70, B2: 20, B3: 10 });     // B2, B3 out → A 3, B 1
  assert.deepEqual(versusOutcome(v), { finished: false, alive: [3, 1] });
  v = playRound(v, { A1: 100, B1: 95, A2: 30, A3: 20 });                      // A2, A3 out → A 1, B 1
  assert.deepEqual(versusOutcome(v), { finished: false, alive: [1, 1] });
  v = playRound(v, { A1: 10, B1: 50 });                                        // only the worse goes: A1
  const o = versusOutcome(v);
  assert.deepEqual(o, { finished: true, winner: "B", alive: [0, 1] });
  assert.equal(v.comp.finished, true);
  assert.deepEqual(versusPayouts(v), { A1: 0, A2: 0, A3: 0, B1: 1000, B2: 1000, B3: 1000 }, "every member of the winning group shares the pot");
}
{
  // A group can lose both of its last players in one round.
  let v = tournament("tn2", team("A", 2), team("B", 2), setup);
  v = playRound(v, { B1: 90, B2: 80, A1: 20, A2: 10 });
  const o = versusOutcome(v);
  assert.deepEqual(o, { finished: true, winner: "B", alive: [0, 2] });
  assert.deepEqual(versusPayouts(v), { A1: 0, A2: 0, B1: 1000, B2: 1000 });
}
{
  // Odd pot: the leftover cent goes to one winner, nothing is lost.
  let v = tournament("tn3", team("A", 3), team("B", 3), { ...setup, entryMinor: 333 });
  v = playRound(v, { A1: 9, A2: 8, A3: 7, B1: 6, B2: 2, B3: 1 });
  v = playRound(v, { A1: 9, A2: 8, A3: 7, B1: 1 });
  const pay = versusPayouts(v)!;
  assert.equal(Object.values(pay).reduce((a, b) => a + b, 0), 333 * 6);
}
// v229 · Eliminatoria v2 (owner, 21-nov): 5 matchdays, points by place among those still in, the worst one out each day.
{
  let v = createGroupVersus("el", "tournament", team("A", 3), team("B", 3), setup);
  assert.equal(v.rules, "v2");
  assert.equal(v.comp.config.end.kind === "rounds" && v.comp.config.end.rounds, ELIMINATORIA_ROUNDS, "always five matchdays");
  v = playRound(v, { A1: 100, B1: 90, A2: 80, B2: 70, A3: 60, B3: 50 });   // A 6+4+2, B 5+3+1; B3 out
  assert.deepEqual(versusPoints(v), [12, 9]);
  assert.deepEqual(versusOutcome(v), { finished: false, alive: [3, 2] });
  v = playRound(v, { B1: 100, A1: 90, B2: 80, A2: 70, A3: 60 });            // A +4+2+1, B +5+3; A3 out
  assert.deepEqual(versusPoints(v), [19, 17]);
  v = playRound(v, { A1: 100, A2: 90, B1: 80, B2: 70 });                    // A +4+3, B +2+1; B2 out
  v = playRound(v, { B1: 100, A1: 90, A2: 80 });                            // B +3, A +2+1; A2 out
  assert.deepEqual(versusOutcome(v), { finished: false, alive: [1, 1] });
  v = playRound(v, { B1: 100, A1: 90 });                                    // B +2, A +1; fifth matchday: the end
  const o = versusOutcome(v);
  assert.deepEqual(o, { finished: true, winner: "A", sums: [30, 25], alive: [0, 1] }, "points decide, not who is left");
  assert.equal(v.comp.finished, true);
  assert.equal(Math.max(...v.comp.matches.map((m) => m.round)), 5, "no sixth matchday");
  assert.deepEqual(versusPayouts(v), { A1: 1000, A2: 1000, A3: 1000, B1: 0, B2: 0, B3: 0 });
}
{
  // Never more than five matchdays, even with players left.
  let v = createGroupVersus("el2", "tournament", team("A", 4), team("B", 4), setup);
  for (let d = 0; d < 5; d++) v = playRound(v, { A1: 9, A2: 8, A3: 7, A4: 6, B1: 5, B2: 4, B3: 3, B4: 2 });
  const o = versusOutcome(v);
  assert.equal(o.finished, true);
  assert.deepEqual(o.finished && o.alive, [4, 0]);
  assert.equal(o.finished && o.winner, "A");
}
{
  // A group with nobody left ends it early; the points so far decide.
  let v = createGroupVersus("el3", "tournament", team("A", 1), team("B", 1), setup);
  v = playRound(v, { B1: 50, A1: 10 });
  assert.deepEqual(versusOutcome(v), { finished: true, winner: "B", sums: [1, 2], alive: [0, 1] });
}
console.log("Group versus: league by sum of positions (best player breaks ties), tournament two out per round (v192) and eliminatoria v2 (5 matchdays, points by place, one out a day), pot to the winning group");
