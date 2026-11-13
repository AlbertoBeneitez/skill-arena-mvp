/**
 * v186 · How studios are paid (owner, 13-nov). The only income is the 5 % commission on changing euros ↔ cosmicoins
 * (lib/wallet.ts); matches have no entry fee. Each month STUDIO_SHARE_BPS of the net commission (collected minus
 * taxes, payment costs and refunds) is split between ALL games in proportion to their counted matches; the part of a
 * studio's games goes to that studio, the part of the house games stays with Galactic Games.
 *
 * Counted matches come from the server only (lib/server/playCounts.ts): verified matches, at most
 * PLAYS_PER_PLAYER_DAILY_CAP per player, game and day, so a studio cannot multiply its share by replaying alone.
 * Pure TypeScript, whole cents, exact totals.
 */
export const STUDIO_SHARE_BPS = 5000;
export const PLAYS_PER_PLAYER_DAILY_CAP = 20;

export type GamePlays = { gameId: string; plays: number };
export type PayoutLine = { creator: string; cents: number; plays: number };

/**
 * Splits `netCommissionCents` for one month. `creatorOf` names who made each game (the house name for house games).
 * Returns the studio pool, one line per creator (house included) and what stays with the house overall.
 */
export function splitCommission(netCommissionCents: number, games: readonly GamePlays[], creatorOf: (gameId: string) => string, house: string) {
  if (!Number.isSafeInteger(netCommissionCents) || netCommissionCents < 0) throw new Error("commission must be whole cents");
  const pool = Math.floor((netCommissionCents * STUDIO_SHARE_BPS) / 10000);
  const byCreator = new Map<string, number>();
  for (const g of games) {
    if (!Number.isSafeInteger(g.plays) || g.plays < 0) throw new Error("plays must be whole numbers");
    const creator = creatorOf(g.gameId);
    byCreator.set(creator, (byCreator.get(creator) ?? 0) + g.plays);
  }
  const total = [...byCreator.values()].reduce((a, b) => a + b, 0);
  const creators = [...byCreator.keys()].sort();
  if (total === 0) {
    return { pool, lines: creators.map((creator) => ({ creator, cents: 0, plays: 0 })), house: netCommissionCents };
  }
  // Largest remainder: floor every share, then hand the leftover cents to the largest fractions (ties by name).
  const raw = creators.map((creator) => ({ creator, plays: byCreator.get(creator)!, exact: (pool * byCreator.get(creator)!) / total }));
  const lines = raw.map((r) => ({ creator: r.creator, plays: r.plays, cents: Math.floor(r.exact) }));
  let left = pool - lines.reduce((a, l) => a + l.cents, 0);
  const order = raw.map((r, i) => ({ i, frac: r.exact - Math.floor(r.exact), name: r.creator })).sort((a, b) => b.frac - a.frac || (a.name < b.name ? -1 : 1));
  for (const o of order) { if (left <= 0) break; lines[o.i].cents += 1; left -= 1; }
  const studios = lines.filter((l) => l.creator !== house).reduce((a, l) => a + l.cents, 0);
  return { pool, lines, house: netCommissionCents - studios };
}
