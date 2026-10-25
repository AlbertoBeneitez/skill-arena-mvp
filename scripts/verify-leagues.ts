import assert from "node:assert/strict";
import { GAMES, lowerScoreWins } from "../lib/games";
import { emptyLeague, leagueRival, recordLeagueResult, type LeagueRecord } from "../lib/leagues";

const play = (start: LeagueRecord, results: boolean[]) => results.reduce(recordLeagueResult, start);
// Five matches per series: 3+ wins promote, 1 or fewer relegate, 2 keep the tier.
{
  let r = play(emptyLeague(), [true, false, true, false]);
  assert.equal(r.results.length, 4);
  assert.equal(r.tier, 0);
  r = recordLeagueResult(r, true);
  assert.deepEqual([r.tier, r.results.length, r.series, r.last?.change, r.last?.wins], [1, 0, 1, "up", 3]);
  r = play(r, [true, true, false, false, false]);
  assert.deepEqual([r.tier, r.last?.change], [1, "stay"]);
  r = play(r, [false, true, false, false, false]);
  assert.deepEqual([r.tier, r.last?.change], [0, "down"]);
  r = play(r, [false, false, false, false, false]);
  assert.deepEqual([r.tier, r.last?.change], [0, "stay"], "Bronze is the floor");
  let top: LeagueRecord = { ...emptyLeague(), tier: 4, best: 4 };
  top = play(top, [true, true, true, true, true]);
  assert.deepEqual([top.tier, top.last?.change], [4, "stay"], "Diamond is the ceiling");
  assert.equal(play({ ...emptyLeague(), tier: 2, best: 2 }, [true, true, true, false, false]).best, 3);
}
// Matchmaking by tier: reproducible, harder rivals in higher tiers, balance games use closing-balance goals.
for (const game of GAMES) {
  const targets = [0, 1, 2, 3, 4].map((tier) => leagueRival(game, { ...emptyLeague(), tier: tier as LeagueRecord["tier"] }).target);
  assert.deepEqual(leagueRival(game, emptyLeague()), leagueRival(game, emptyLeague()));
  // Harder tiers: higher targets, or SMALLER target times for time-scored games.
  const harder = (hi: number, lo: number) => (lowerScoreWins(game) ? hi <= lo : hi >= lo);
  for (let i = 1; i < 5; i++) assert.ok(harder(targets[i], targets[i - 1]), `${game.id} tiers get harder (${targets.join(",")})`);
  assert.ok(targets[4] !== targets[0] && harder(targets[4], targets[0]), game.id);
  if (lowerScoreWins(game)) assert.equal(leagueRival(game, emptyLeague()).timeGoal, true);
  if (game.resultMetric === "fictitious-balance") assert.equal(targets[0], 10000);
}
const a = leagueRival(GAMES[3], { ...emptyLeague(), tier: 2, results: [true] }), b = leagueRival(GAMES[3], { ...emptyLeague(), tier: 2, results: [true, false] });
assert.notDeepEqual([a.name, a.target], [b.name, b.target], "each match in a series meets a different rival");
console.log("Leagues OK · 5-match series · promote ≥3 · relegate ≤1 · tiered simulated rivals for", GAMES.length, "games");
