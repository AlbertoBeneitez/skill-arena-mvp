import assert from "node:assert/strict";
import { GAMES, lowerScoreWins } from "../lib/games";
import { TIER_WINS, emptyLeague, gameWins, isLeagueState, leagueRival, recordLeagueResult, tierForWins, tierProgress, type LeagueRecord } from "../lib/leagues";

const play = (start: LeagueRecord, results: boolean[]) => results.reduce(recordLeagueResult, start);
// v218: the tier is earned by the wins in the game (0, 5, 15, 30, 50) and never lost.
{
  assert.deepEqual([0, 4, 5, 14, 15, 29, 30, 49, 50, 999].map(tierForWins), [0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
  let r = play(emptyLeague(), [true, false, true, true, false, true]);
  assert.deepEqual([r.tier, r.wins, r.series, r.last?.change], [0, 4, 6, "stay"]);
  r = recordLeagueResult(r, true);
  assert.deepEqual([r.tier, r.wins, r.last?.change, r.last?.from, r.last?.to], [1, 5, "up", 0, 1], "fifth win: silver");
  r = play(r, Array(20).fill(false));
  assert.deepEqual([r.tier, r.wins, r.last?.change], [1, 5, "stay"], "losses never take a tier away");
  r = play(r, Array(45).fill(true));
  assert.deepEqual([r.tier, r.wins, r.best], [4, 50, 4]);
  assert.deepEqual(tierProgress(r), { tier: 4, wins: 50, next: null, missing: 0, fill: 1 });
  assert.deepEqual(tierProgress({ ...emptyLeague(), wins: 10 }), { tier: 1, wins: 10, next: 2, missing: 5, fill: 0.5 });
  // Records saved before v218 (no wins) keep their tier: they start at its threshold.
  const old = { tier: 3, results: [true, false], series: 9, best: 4 } as LeagueRecord;
  assert.ok(isLeagueState({ g: old }));
  assert.equal(gameWins(old), TIER_WINS[3]);
  assert.deepEqual([recordLeagueResult(old, false).tier, recordLeagueResult(old, true).wins], [3, 31]);
  assert.ok(!isLeagueState({ g: { ...emptyLeague(), wins: -1 } }));
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
const a = leagueRival(GAMES[3], recordLeagueResult({ ...emptyLeague(), tier: 2 }, true)), b = leagueRival(GAMES[3], play({ ...emptyLeague(), tier: 2 }, [true, false]));
assert.notDeepEqual([a.name, a.target], [b.name, b.target], "each match meets a different rival");
console.log("Leagues OK · tiers by wins per game (0/5/15/30/50, never lost) · legacy records keep their tier · tiered simulated rivals for", GAMES.length, "games");
