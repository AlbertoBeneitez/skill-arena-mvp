/** v192 · Group against group: league by sum of positions, tournament two out per round until a group is empty. */
import assert from "node:assert/strict";
import { createGroupVersus, recordVersusScore, versusOutcome, versusPayouts, type GroupVersus, type VersusTeam } from "../lib/groupVersus";

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

// Tournament: the two worst of everyone go each round; it ends when a group has nobody left.
{
  let v = createGroupVersus("tn", "tournament", team("A", 3), team("B", 3), setup);
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
  let v = createGroupVersus("tn2", "tournament", team("A", 2), team("B", 2), setup);
  v = playRound(v, { B1: 90, B2: 80, A1: 20, A2: 10 });
  const o = versusOutcome(v);
  assert.deepEqual(o, { finished: true, winner: "B", alive: [0, 2] });
  assert.deepEqual(versusPayouts(v), { A1: 0, A2: 0, B1: 1000, B2: 1000 });
}
{
  // Odd pot: the leftover cent goes to one winner, nothing is lost.
  let v = createGroupVersus("tn3", "tournament", team("A", 3), team("B", 3), { ...setup, entryMinor: 333 });
  v = playRound(v, { A1: 9, A2: 8, A3: 7, B1: 6, B2: 2, B3: 1 });
  v = playRound(v, { A1: 9, A2: 8, A3: 7, B1: 1 });
  const pay = versusPayouts(v)!;
  assert.equal(Object.values(pay).reduce((a, b) => a + b, 0), 333 * 6);
}
console.log("Group versus: league by sum of positions (best player breaks ties), tournament two out per round, pot to the winning group");
