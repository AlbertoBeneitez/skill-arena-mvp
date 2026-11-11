import assert from "node:assert/strict";
import {
  DEFAULT_SPLITS, MAX_PAID_PLACES, RANDOM_GAME, createGroupCompetition, roundGame, defaultSplit, groupMoney, isValidSplit, splitShares, stepSplit, groupStandings, isGroupCompetition, nextGroupMatch, recordGroupScore, voteToEndGroup,
  type GroupCompetition, type GroupConfig, type GroupPlayer,
} from "../lib/groupCompetition";
import { playSimulatedMembers, voteWithSimulatedMembers } from "../lib/demo/groupRivals";

const players = (n: number): GroupPlayer[] => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, avatar: "", simulated: i > 0 }));
const cfg = (over: Partial<GroupConfig>): GroupConfig => ({ format: "single", entryMinor: 500, split: "winner", gameIds: ["g"], lowerWinsGameIds: [], end: { kind: "rounds", rounds: 1 }, ...over });
const play = (c: GroupCompetition, scores: Record<string, number>) => {
  for (const [id, s] of Object.entries(scores)) { const i = nextGroupMatch(c, id); if (i >= 0) c = recordGroupScore(c, i, id, s); }
  return c;
};
/** Competitions saved before v174 have no tie-break: they keep shared results. */
const legacy = (c: GroupCompetition): GroupCompetition => { const config = { ...c.config }; delete config.tieBreak; return { ...c, config }; };
const total = (c: GroupCompetition) => Object.values(c.payouts ?? {}).reduce((a, b) => a + b, 0);

// One entry fee each; the pot keeps a 5 % commission.
assert.deepEqual(groupMoney({ config: cfg({}), players: players(4) }), { pot: 2000, commission: 100, prize: 1900 });

// Single match: the best score takes the prize; 70/30 pays the first two; a tie shares the places it occupies.
{
  let c = createGroupCompetition("s", cfg({}), players(4));
  c = play(c, { p0: 10, p1: 40, p2: 20, p3: 30 });
  assert.ok(c.finished);
  assert.equal(c.payouts!.p1, 1900);
  assert.equal(total(c), 1900);
  let d = legacy(createGroupCompetition("s2", cfg({ split: "70-30" }), players(3)));
  d = play(d, { p0: 9, p1: 9, p2: 1 });
  assert.equal(d.payouts!.p0 + d.payouts!.p1, groupMoney(d).prize, "legacy: two tied winners share 70 % + 30 %");
  assert.ok(Math.abs(d.payouts!.p0 - d.payouts!.p1) <= 1);
  assert.equal(d.payouts!.p2, 0);
}
// Scores are recorded once, only for the players of the match.
{
  const c = createGroupCompetition("r", cfg({}), players(2));
  const once = recordGroupScore(c, 0, "p0", 5);
  assert.equal(recordGroupScore(once, 0, "p0", 99), once);
  assert.equal(recordGroupScore(c, 0, "intruder", 5), c);
}
// League of individual rounds: N rounds, a victory per round, lower-wins games respected.
{
  let c = createGroupCompetition("l", cfg({ format: "league-rounds", gameIds: ["g", "t"], lowerWinsGameIds: ["t"], end: { kind: "rounds", rounds: 3 } }), players(3));
  c = play(c, { p0: 50, p1: 10, p2: 20 });      // round 1, game g: p0 wins
  assert.equal(c.matches.at(-1)!.gameId, "t");
  c = play(c, { p0: 900, p1: 300, p2: 500 });   // round 2, game t (time): p1 wins
  assert.ok(!c.finished);
  c = play(c, { p0: 80, p1: 10, p2: 5 });       // round 3: p0 wins
  assert.ok(c.finished);
  const st = groupStandings(c);
  assert.deepEqual([st[0].id, st[0].wins, st[1].id, st[1].wins], ["p0", 2, "p1", 1]);
  assert.equal(c.payouts!.p0, groupMoney(c).prize);
}
// League of duels: a round-robin calendar, every pair meets once per cycle; with an odd count one player rests.
{
  const c = createGroupCompetition("d", cfg({ format: "league-duels", end: { kind: "rounds", rounds: 3 } }), players(4));
  let x = c;
  const met = new Set<string>();
  for (let r = 1; r <= 3; r++) {
    const round = x.matches.filter((m) => m.round === r);
    assert.equal(round.length, 2);
    for (const m of round) met.add([...m.players].sort().join("-"));
    x = play(x, { p0: 1, p1: 2, p2: 3, p3: 4 });
  }
  assert.equal(met.size, 6, "all six pairs meet");
  assert.ok(x.finished);
  const odd = createGroupCompetition("o", cfg({ format: "league-duels", end: { kind: "rounds", rounds: 5 } }), players(5));
  assert.equal(odd.matches.filter((m) => m.round === 1).length, 2);
}
// Tournament: the lowest score of each round is out until one is left; elimination order is the ranking.
{
  let c = createGroupCompetition("t", cfg({ format: "tournament", split: "70-30" }), players(4));
  c = play(c, { p0: 4, p1: 3, p2: 2, p3: 1 });
  assert.deepEqual(c.eliminated, ["p3"]);
  c = play(c, { p0: 1, p1: 3, p2: 2 });
  assert.deepEqual(c.eliminated, ["p3", "p0"]);
  c = play(c, { p1: 5, p2: 6 });
  assert.ok(c.finished);
  const st = groupStandings(c);
  assert.deepEqual(st.map((s) => s.id), ["p2", "p1", "p0", "p3"]);
  assert.equal(c.payouts!.p2, Math.floor(groupMoney(c).prize * 0.7));
  assert.equal(total(c), groupMoney(c).prize);
}
// v171 · Eliminatorias with two knocked out per round: 6 → 4 → 2 → 1 (never fewer than one left).
{
  let c = createGroupCompetition("e2", cfg({ format: "tournament", split: [70, 20, 10, 0, 0, 0], eliminatePerRound: 2 }), players(6));
  c = play(c, { p0: 6, p1: 5, p2: 4, p3: 3, p4: 2, p5: 1 });
  assert.deepEqual(c.eliminated, ["p5", "p4"], "worst first");
  c = play(c, { p0: 1, p1: 2, p2: 3, p3: 4 });
  assert.deepEqual(c.eliminated, ["p5", "p4", "p0", "p1"]);
  c = play(c, { p2: 1, p3: 2 });
  assert.ok(c.finished, "two left and two to knock out: only one goes, the other wins");
  assert.deepEqual(groupStandings(c).map((s) => s.id), ["p3", "p2", "p1", "p0", "p4", "p5"]);
  assert.equal(total(c), groupMoney(c).prize);
}
// v174 · Tie-breaks: equal scores go to the faster player, then to a reproducible draw — never to list order.
{
  const timed = (c: GroupCompetition, scores: Record<string, [number, number?]>) => {
    for (const [id, [sc, ms]] of Object.entries(scores)) { const i = nextGroupMatch(c, id); if (i >= 0) c = recordGroupScore(c, i, id, sc, ms); }
    return c;
  };
  let a = createGroupCompetition("tb1", cfg({ split: "70-30" }), players(3));
  assert.equal(a.config.tieBreak, "time-v1", "new competitions carry the tie-break");
  a = timed(a, { p0: [9, 60000], p1: [9, 50000], p2: [1, 1000] });
  assert.ok(a.payouts!.p1 > a.payouts!.p0, "same score: the faster one takes 1st");
  assert.deepEqual(groupStandings(a).map((r) => r.place), [1, 2, 3], "no shared places");
  // No times at all: a seeded draw, the same every time, independent of the player list order.
  const draw = (order: string[]) => {
    let c = createGroupCompetition("tb2", cfg({ split: "70-30" }), order.map((id) => ({ id, name: id, avatar: "" })));
    c = timed(c, { p0: [5], p1: [5], p2: [5] });
    return groupStandings(c).map((r) => r.id).join(",");
  };
  assert.equal(draw(["p0", "p1", "p2"]), draw(["p2", "p0", "p1"]), "the draw does not depend on list order");
  assert.equal(draw(["p0", "p1", "p2"]), draw(["p0", "p1", "p2"]), "reproducible");
  // Eliminatorias: a tie at the bottom knocks out the slower one; same-round knock-outs get distinct places.
  let e = createGroupCompetition("tb3", cfg({ format: "tournament", split: [70, 20, 10, 0] }), players(4));
  e = timed(e, { p0: [8, 1], p1: [5, 1], p2: [3, 40000], p3: [3, 30000] });
  assert.deepEqual(e.eliminated, ["p2"], "p2 and p3 tie; p2 was slower");
  let k = createGroupCompetition("tb4", cfg({ format: "tournament", split: [70, 20, 10, 0, 0], eliminatePerRound: 2 }), players(5));
  k = timed(k, { p0: [9, 1], p1: [8, 1], p2: [7, 1], p3: [2, 70000], p4: [2, 20000] });
  assert.deepEqual(k.eliminated, ["p3", "p4"], "equal scores in the same round: slower ranks below");
  // Duels: an equal duel is won on time.
  let du = createGroupCompetition("tb5", cfg({ format: "league-duels", end: { kind: "rounds", rounds: 1 } }), players(2));
  du = timed(du, { p0: [4, 9000], p1: [4, 8000] });
  assert.equal(groupStandings(du).find((r) => r.id === "p1")!.wins, 1);
  assert.equal(total(du), groupMoney(du).prize);
}
// Vote rule: the league ends when a majority votes; open matches do not count; nobody votes twice.
{
  let c = createGroupCompetition("v", cfg({ format: "league-rounds", end: { kind: "vote" } }), players(4));
  c = play(c, { p0: 3, p1: 2, p2: 1, p3: 0 });
  c = play(c, { p0: 5 });                       // round 2 open
  c = voteToEndGroup(voteToEndGroup(voteToEndGroup(c, "p1"), "p1"), "p2");
  assert.ok(!c.finished, "2 of 4 is not a majority");
  c = voteToEndGroup(c, "p3");
  assert.ok(c.finished);
  assert.ok(c.matches.every((m) => m.round === 1), "the open round is dropped");
  assert.equal(c.payouts!.p0, groupMoney(c).prize);
}
// Local play with simulated members is deterministic and always reaches a full settlement.
{
  const look = { base: () => 1000, strength: (id: string) => (id === "p0" ? 1 : 0.9 + Number(id.slice(1)) * 0.05) };
  const run = () => {
    let c = playSimulatedMembers(createGroupCompetition("sim", cfg({ format: "league-duels", end: { kind: "rounds", rounds: 4 } }), players(5)), "p0", look);
    for (let k = 0; k < 10 && !c.finished; k++) { const i = nextGroupMatch(c, "p0"); if (i >= 0) c = recordGroupScore(c, i, "p0", 1000 + k); c = playSimulatedMembers(c, "p0", look); }
    return c;
  };
  const a = run(), b = run();
  assert.deepEqual(a, b, "same competition, same result");
  assert.ok(a.finished);
  assert.equal(total(a), groupMoney(a).prize);
  let v = playSimulatedMembers(createGroupCompetition("vote", cfg({ format: "league-rounds", end: { kind: "vote" } }), players(4)), "p0", look);
  for (let k = 0; k < 3; k++) { v = recordGroupScore(v, nextGroupMatch(v, "p0"), "p0", 900); v = playSimulatedMembers(v, "p0", look); }
  v = voteWithSimulatedMembers(v, "p0");
  assert.equal(typeof v.finished, "boolean");
  assert.ok(isGroupCompetition(JSON.parse(JSON.stringify(a))), "survives a save and reload");
  assert.equal(isGroupCompetition({ id: 1 }), false);
}
// v166/v171 · Custom splits: whole percentages, never rising from one place to the next, adding up to 100;
// lower places may get 0; the +/- buttons move 5 points and keep that shape.
{
  for (let n = 1; n <= MAX_PAID_PLACES; n++) assert.ok(isValidSplit(DEFAULT_SPLITS[n]), `default split for ${n}`);
  assert.deepEqual(defaultSplit(6), [70, 20, 10, 0, 0, 0]);
  assert.deepEqual(defaultSplit(3), [70, 20, 10]);
  assert.deepEqual(defaultSplit(2), [70, 30]);
  assert.deepEqual(defaultSplit(1), [100]);
  assert.equal(isValidSplit([50, 50]), true, "equal places are allowed (v171)");
  assert.equal(isValidSplit([70, 20, 10, 0, 0]), true, "places without a prize");
  assert.equal(isValidSplit([30, 70]), false, "a lower place cannot pay more");
  assert.equal(isValidSplit([60, 30]), false, "must add up to 100");
  assert.equal(isValidSplit([0, 0]), false, "the winner always gets something");
  assert.deepEqual(splitShares([70, 20, 10]), [7000, 2000, 1000]);
  assert.deepEqual(splitShares([10, 20, 70]), [10000], "an invalid stored split falls back to winner takes all");
  assert.deepEqual(splitShares("70-30"), [7000, 3000], "legacy presets still settle");
  const base = defaultSplit(5);
  assert.deepEqual(stepSplit(base, 0, 1), [75, 20, 5, 0, 0], "+ on the 1st takes from the last paid place");
  assert.deepEqual(stepSplit(base, 0, -1), [65, 20, 15, 0, 0], "- on the 1st gives to the last paid place");
  assert.deepEqual(stepSplit(base, 2, -1), [70, 20, 5, 5, 0], "- on the last paid place pays one more place");
  assert.deepEqual(stepSplit(base, 2, 1), [70, 15, 15, 0, 0], "+ on the last paid place takes from the place above");
  assert.deepEqual(stepSplit(base, 3, 1), [70, 20, 5, 5, 0], "+ on a place without prize");
  assert.deepEqual(stepSplit([100, 0, 0], 1, 1), [95, 5, 0]);
  assert.equal(stepSplit([100, 0, 0], 0, 1), null, "the 1st cannot go over 100");
  assert.equal(stepSplit([50, 50], 1, 1), null, "the 2nd cannot overtake the 1st");
  assert.equal(stepSplit([100], 0, 1), null);
  // Any sequence of presses keeps the split valid.
  let v = defaultSplit(6);
  for (let k = 0; k < 400; k++) { const r = stepSplit(v, (k * 7) % 6, k % 3 ? 1 : -1); if (r) { assert.ok(isValidSplit(r), String(r)); v = r; } }
  // Settlement with a 3-place split: 70 / 20 / 10 of the prize, nothing lost to rounding.
  let c = createGroupCompetition("sp", cfg({ split: [70, 20, 10] }), players(5));
  c = play(c, { p0: 50, p1: 40, p2: 30, p3: 20, p4: 10 });
  const prize = groupMoney(c).prize;
  assert.equal(c.payouts!.p1, Math.floor(prize * 0.2));
  assert.equal(c.payouts!.p2, Math.floor(prize * 0.1));
  assert.equal(c.payouts!.p0, prize - Math.floor(prize * 0.2) - Math.floor(prize * 0.1), "rounding remainder goes to the winner");
  assert.equal(c.payouts!.p3, 0);
  assert.equal(total(c), prize);
  assert.ok(isGroupCompetition(JSON.parse(JSON.stringify(c))), "an array split survives a save and reload");
}
// v175 · «Aleatorio» is one more slot: drawn from the pool only when its round starts, reproducibly.
{
  const pool = ["a", "b", "c", "d", "e"];
  const conf = cfg({ format: "league-rounds", gameIds: ["slot", RANDOM_GAME, "darts", RANDOM_GAME], randomPool: pool, end: { kind: "rounds", rounds: 8 } });
  let c = createGroupCompetition("rnd", conf, players(3));
  assert.equal(c.matches.length, 1, "only the first round exists at the start");
  assert.equal(c.matches[0].gameId, "slot");
  for (let r = 0; r < 8 && !c.finished; r++) c = play(c, { p0: 3, p1: 2, p2: 1 });
  const games = [...new Set(c.matches.map((m) => m.round))].map((r) => c.matches.find((m) => m.round === r)!.gameId);
  assert.equal(games.length, 8);
  assert.equal(games[0], "slot"); assert.equal(games[2], "darts"); assert.equal(games[4], "slot"); assert.equal(games[6], "darts");
  for (const r of [1, 3, 5, 7]) assert.ok(pool.includes(games[r]), `round ${r + 1} draws from the pool`);
  assert.ok(!games.includes(RANDOM_GAME), "a scheduled match never carries the placeholder");
  for (let r = 1; r <= 8; r++) assert.equal(roundGame(c, r), games[r - 1], "the draw is reproducible");
  const draws = new Set(Array.from({ length: 40 }, (_, k) => roundGame({ id: `x${k}`, config: conf }, 2)));
  assert.ok(draws.size >= 3, "different competitions draw different games");
  assert.throws(() => createGroupCompetition("bad", cfg({ gameIds: [RANDOM_GAME] }), players(2)), /pool/);
  assert.throws(() => createGroupCompetition("bad2", cfg({ gameIds: [RANDOM_GAME], randomPool: [RANDOM_GAME] }), players(2)), /pool/);
  const single = createGroupCompetition("one", cfg({ gameIds: [RANDOM_GAME], randomPool: pool }), players(2));
  assert.ok(pool.includes(single.matches[0].gameId), "a single random match is drawn at once");
  assert.ok(isGroupCompetition(JSON.parse(JSON.stringify(c))));
}
console.log("Group competitions OK · single / league rounds / league duels / tournament · 5 % commission · ties · vote · simulated members · custom splits · eliminations per round · tie-breaks (time, seeded draw; legacy shared) · random slots");
