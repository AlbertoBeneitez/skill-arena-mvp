/** v217 · The three group modalities (owner, 18-nov): todos vs todos, 1 vs 1 between groups, relays between groups. */
import assert from "node:assert/strict";
import {
  HOME_TEAM, assignRival, createGroupCompetition, groupStandings, groupTeamStandings, isGroupCompetition, nextGroupMatch, recordGroupScore,
  relayTotals, relayWaitingFor, roundAwaitingRival, waitingGroupMatch, type GroupCompetition, type GroupConfig, type GroupPlayer,
} from "../lib/groupCompetition";
import { inventRivalGroup, playSimulatedMembers } from "../lib/demo/groupRivals";

const team = (prefix: string, n: number): GroupPlayer[] => Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, name: `${prefix.toUpperCase()}${i}`, avatar: "", simulated: i > 0 }));
const cfg = (over: Partial<GroupConfig>): GroupConfig => ({ format: "all-vs-all", entryMinor: 0, split: "winner", gameIds: ["g"], lowerWinsGameIds: [], end: { kind: "rounds", rounds: 2 }, ...over });
const rival = (key: string, n: number) => ({ id: `grp-${key}`, name: `Grupo ${key}`, players: team(key, n) });
const pts = (c: GroupCompetition) => Object.fromEntries(groupStandings(c).map((s) => [s.id, s.points]));

// Todos vs todos: N points for the first, one less per place, 1 for the last; points add up matchday after matchday.
{
  let c = createGroupCompetition("ava", cfg({}), team("p", 4));
  assert.equal(c.matches.length, 1);
  assert.deepEqual(c.matches[0].players, ["p0", "p1", "p2", "p3"]);
  for (const [id, s] of Object.entries({ p0: 40, p1: 30, p2: 20, p3: 10 })) c = recordGroupScore(c, nextGroupMatch(c, id), id, s, 1000);
  assert.deepEqual(pts(c), { p0: 4, p1: 3, p2: 2, p3: 1 }, "N … 1");
  assert.equal(c.matches.length, 2, "the next matchday opens once everyone has played");
  // Matchday 2 open: nobody else is scored until each has played (no deadline).
  c = recordGroupScore(c, 1, "p3", 99, 1000);
  assert.deepEqual(pts(c), { p0: 4, p1: 3, p2: 2, p3: 1 }, "an open matchday adds nothing");
  for (const [id, s] of Object.entries({ p0: 1, p1: 2, p2: 3 })) c = recordGroupScore(c, nextGroupMatch(c, id), id, s, 1000);
  assert.deepEqual(pts(c), { p0: 5, p1: 5, p2: 5, p3: 5 });
  assert.ok(c.finished);
  // Equal points: more matchdays won first; equal points and wins share the place.
  assert.deepEqual(groupStandings(c).map((s) => [s.id, s.place]).sort(), [["p0", 1], ["p1", 3], ["p2", 3], ["p3", 1]]);
  // Reaction games: the lower time is first.
  let r = createGroupCompetition("ava-low", cfg({ lowerWinsGameIds: ["g"], end: { kind: "rounds", rounds: 1 } }), team("p", 3));
  for (const [id, s] of Object.entries({ p0: 300, p1: 200, p2: 400 })) r = recordGroupScore(r, 0, id, s, 1000);
  assert.deepEqual(pts(r), { p1: 3, p0: 2, p2: 1 });
  // A tie is broken by the time played, so the points stay N … 1.
  let t = createGroupCompetition("ava-tie", cfg({ end: { kind: "rounds", rounds: 1 } }), team("p", 2));
  t = recordGroupScore(t, 0, "p0", 50, 9000); t = recordGroupScore(t, 0, "p1", 50, 4000);
  assert.deepEqual(pts(t), { p1: 2, p0: 1 });
}

// 1 vs 1 between groups: no matches until a rival group of the same size is found; then random pairs, 2 / 0 points.
{
  let c = createGroupCompetition("duel", cfg({ format: "duel-groups", entryMinor: 500 }), team("p", 3));
  assert.equal(c.config.entryMinor, 0, "inter-group modalities move no money");
  assert.equal(c.matches.length, 0);
  assert.equal(roundAwaitingRival(c), 1);
  assert.equal(nextGroupMatch(c, "p0"), -1);
  assert.throws(() => assignRival(c, rival("x", 2)), /same number/);
  assert.throws(() => assignRival(c, { id: "grp-me", name: "Me", players: team("p", 3) }), /itself/);
  c = assignRival(c, rival("x", 3));
  assert.equal(roundAwaitingRival(c), 0);
  assert.equal(c.matches.length, 3);
  const pairs = c.matches.map((m) => m.players);
  assert.deepEqual(pairs.map((p) => p[0]).sort(), ["p0", "p1", "p2"]);
  assert.deepEqual(pairs.map((p) => p[1]).sort(), ["x0", "x1", "x2"], "each member against a member of the rival group");
  assert.deepEqual(assignRival(createGroupCompetition("duel", cfg({ format: "duel-groups" }), team("p", 3)), rival("x", 3)).matches, c.matches, "reproducible pairs");
  assert.equal(assignRival(c, rival("y", 3)), c, "one rival per matchday");
  c = recordGroupScore(recordGroupScore(c, 0, c.matches[0].players[0], 99, 1000), 0, c.matches[0].players[1], 1, 1000);
  assert.deepEqual(pts(c), { p0: 0, p1: 0, p2: 0 }, "an open matchday adds nothing, even with a duel decided");
  for (const m of c.matches) {
    const i = c.matches.indexOf(m), [ours, theirs] = m.players;
    if (i === 0) continue;
    c = recordGroupScore(c, i, ours, 10, 1000);
    c = recordGroupScore(c, i, theirs, 50, 1000);
  }
  const first = c.matches[0].players[0], others = ["p0", "p1", "p2"].filter((id) => id !== first);
  assert.deepEqual(pts(c), { [first]: 2, [others[0]]: 0, [others[1]]: 0 }, "the winner of each duel scores 2, the loser 0");
  assert.ok(!groupStandings(c).some((s) => s.id.startsWith("x")), "the rival group's players are not in our table");
  assert.equal(roundAwaitingRival(c), 2, "the next matchday waits for a new rival");
  c = assignRival(c, rival("y", 3));
  assert.equal(c.rivals?.length, 2);
  assert.ok(isGroupCompetition(JSON.parse(JSON.stringify(c))));
}

// Relays between groups: each group plays in order, the totals add up, the better group scores 2 per member.
{
  let c = createGroupCompetition("relay", cfg({ format: "relay-groups", end: { kind: "rounds", rounds: 2 } }), team("p", 3));
  c = assignRival(c, rival("x", 3));
  const m = c.matches[0];
  assert.deepEqual(m.players, ["p0", "p1", "p2", "x0", "x1", "x2"], "matchday 1: the members' order");
  assert.equal(relayWaitingFor(c, m, "p1"), "p0", "p1 waits for p0");
  assert.equal(relayWaitingFor(c, m, "x0"), null, "the rival group runs its own relay at the same time");
  assert.equal(nextGroupMatch(c, "p1"), -1);
  assert.equal(waitingGroupMatch(c, "p1"), 0);
  assert.equal(recordGroupScore(c, 0, "p1", 10, 1000), c, "out of turn: refused");
  for (const [id, s] of [["p0", 30], ["x0", 20], ["p1", 30], ["x1", 50], ["p2", 30], ["x2", 21]] as const) c = recordGroupScore(c, 0, id, s, 1000);
  assert.deepEqual(relayTotals(c, c.matches[0]), { home: 90, away: 91, homeTime: 3000, awayTime: 3000 });
  assert.deepEqual(pts(c), { p0: 0, p1: 0, p2: 0 }, "a relay lost scores 0");
  let table = groupTeamStandings(c, "Nosotros");
  assert.deepEqual(table.map((r) => [r.id, r.points, r.place]), [["grp-x", 2, 1], [HOME_TEAM, 0, 2]]);
  c = assignRival(c, rival("y", 3));
  assert.deepEqual(c.matches[1].players.slice(0, 3), ["p1", "p2", "p0"], "the order rotates every matchday");
  for (const [id, s] of [["p1", 40], ["p2", 40], ["p0", 40], ["y1", 1], ["y2", 1], ["y0", 1]] as const) c = recordGroupScore(c, 1, id, s, 1000);
  assert.deepEqual(pts(c), { p0: 2, p1: 2, p2: 2 }, "a relay won scores 2 per member");
  table = groupTeamStandings(c, "Nosotros");
  assert.deepEqual(table.map((r) => [r.id, r.points, r.won, r.lost]), [[HOME_TEAM, 2, 1, 1], ["grp-x", 2, 1, 0], ["grp-y", 0, 0, 1]]);
  assert.ok(c.finished);
  // Equal totals: the faster group wins.
  let e = assignRival(createGroupCompetition("relay-eq", cfg({ format: "relay-groups", end: { kind: "rounds", rounds: 1 } }), team("p", 2)), rival("x", 2));
  for (const [id, s, ms] of [["p0", 5, 5000], ["p1", 5, 4000], ["x0", 5, 3000], ["x1", 5, 3000]] as const) e = recordGroupScore(e, 0, id, s, ms);
  assert.equal(groupTeamStandings(e, "N")[0].id, "grp-x");
}

// Offline: invented rival groups play by themselves, respecting the relay order (the human's mates after them wait).
{
  const look = { base: () => 1000, strength: () => 1 };
  const g = inventRivalGroup("k1", 3, ["Ana", "Bea", "Cris", "Dani"], ["Orión"], ["a.png"]);
  assert.equal(g.players.length, 3);
  assert.deepEqual(inventRivalGroup("k1", 3, ["Ana", "Bea", "Cris", "Dani"], ["Orión"], ["a.png"]), g, "reproducible");
  assert.equal(new Set(g.players.map((p) => p.name)).size, 3);
  // p1 is the human; p0 plays before them, p2 after them.
  let c = playSimulatedMembers(assignRival(createGroupCompetition("off", cfg({ format: "relay-groups", end: { kind: "rounds", rounds: 1 } }), team("p", 3)), g), "p1", look);
  const m = c.matches[0];
  assert.ok(m.scores.p0 !== undefined && g.players.every((p) => m.scores[p.id] !== undefined), "p0 and the rival group have played");
  assert.equal(m.scores.p2, undefined, "p2 waits for the human");
  assert.equal(nextGroupMatch(c, "p1"), 0);
  c = playSimulatedMembers(recordGroupScore(c, 0, "p1", 999, 1000), "p1", look);
  assert.ok(c.finished, "after the human, the rest of the relay is played");
  // 1 vs 1 offline.
  let d = playSimulatedMembers(assignRival(createGroupCompetition("off-d", cfg({ format: "duel-groups", end: { kind: "rounds", rounds: 1 } }), team("p", 2)), inventRivalGroup("k2", 2, ["A", "B"], ["Z"], [])), "p0", look);
  assert.equal(d.matches.filter((x) => Object.keys(x.scores).length === 2).length, 1, "the other duel is played");
  d = playSimulatedMembers(recordGroupScore(d, nextGroupMatch(d, "p0"), "p0", 5000, 1000), "p0", look);
  assert.ok(d.finished);
  assert.equal(groupStandings(d).find((s) => s.id === "p0")?.points, 2);
}
console.log("Group modalities OK · todos vs todos (N…1) · 1 vs 1 between groups (random pairs, 2/0) · relays between groups (order, totals, 2/0, rotation, group table) · invented rival groups offline");
