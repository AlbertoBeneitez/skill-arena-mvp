/**
 * Leagues per game, eight tiers (bronze → diamond, then v220 wood → amber → pearl). v218 (owner, 18-nov): the tier is earned by the number of wins in
 * that game — every match won in it counts (league duels, public matches, group matches) — and is never lost
 * (`TIER_WINS`). Before v218 a five-match series promoted or relegated; records saved then keep their tier (they
 * start from that tier's threshold). Offline, each league match is paired with a simulated rival of the player's
 * tier: its score is the target to beat. Presentation/local state only — never authoritative, never used for real
 * money or real rankings.
 */
import type { GameMeta } from "./games";
import { createRng } from "./deterministic/seeded";
import { portraitSrc } from "@/lib/avatars";

/** v220 (owner): after diamond come materials made by living things — far rarer in space than any gem: wood, amber,
 * pearl. */
export const LEAGUE_TIERS = ["bronze", "silver", "gold", "platinum", "diamond", "wood", "amber", "pearl"] as const;
export type LeagueTier = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const TOP_TIER = (LEAGUE_TIERS.length - 1) as LeagueTier;
export const LEAGUE_COLORS = ["#d08a4c", "#c9d3e0", "#f3c55a", "#7fe3ee", "#b98cff", "#a4713f", "#ffae1f", "#efe7f6"] as const;
export const LEAGUE_ICONS = ["🥉", "🥈", "🥇", "💠", "💎", "🪵", "🔶", "🦪"] as const;

/** v218: wins in a game needed for each tier (bronze, silver, gold, platinum, diamond). */
export const TIER_WINS = [0, 5, 15, 30, 50, 80, 120, 175] as const;
export const tierForWins = (wins: number): LeagueTier => (TIER_WINS.reduce<number>((tier, need, i) => (wins >= need ? i : tier), 0) as LeagueTier);
/** Wins still needed for the next tier (null at diamond) and how far the current one is filled (0–1). */
export function tierProgress(record: LeagueRecord) {
  const wins = gameWins(record), tier = tierForWins(wins);
  if (tier === TOP_TIER) return { tier, wins, next: null, missing: 0, fill: 1 };
  const from = TIER_WINS[tier], to = TIER_WINS[tier + 1];
  return { tier, wins, next: (tier + 1) as LeagueTier, missing: to - wins, fill: (wins - from) / (to - from) };
}
/** Wins counted in a game; a record saved before v218 starts at its tier's threshold. */
export const gameWins = (record: LeagueRecord) => (typeof record.wins === "number" ? record.wins : TIER_WINS[record.tier]);

export type LeagueRecord = {
  tier: LeagueTier;
  /** v218: matches won in this game (missing in records saved before v218). */
  wins?: number;
  /** Results of the current series, oldest first (true = win). */
  results: boolean[];
  /** Completed series so far (drives the rival rotation). */
  series: number;
  best: LeagueTier;
  /** The last match: v218 "up" when it reached a new tier ("down" only in records saved before v218). */
  last?: { change: "up" | "down" | "stay"; from: LeagueTier; to: LeagueTier; wins: number };
};
export type LeagueState = Record<string, LeagueRecord>;

export const emptyLeague = (): LeagueRecord => ({ tier: 0, wins: 0, results: [], series: 0, best: 0 });

/** Platinum-level reference score per game (higher is better). Balance games use their own goals. */
const REFERENCE: Record<string, number> = {
  darts: 800,
  billiards: 8000,
  "tower-drop": 6200,
  "solitaire-sprint": 22500,
  "mine-grid": 6000,
  "stack-shift": 16000,
  "orb-burst": 110, // orbs eliminated (V8)
  "precision-stack": 600000,
  "reaction-test": 15000, // accumulated ms (lower is better)
  pinball: 65000,
  "corner-sudoku": 3200,
  bowling: 180,
};
/** Score caps: the target never exceeds what a perfect run can reach. */
const CAP: Record<string, number> = {};
const FACTORS = [0.45, 0.65, 0.85, 1, 1.2, 1.42, 1.68, 2] as const;
/** Balance games start with 100 chips (10 000 minor units): the goal is the closing balance. */
const BALANCE_GOALS = [10000, 11000, 12500, 15000, 20000, 26000, 33000, 42000] as const;

export const RIVALS = [
  ["COMET", "PIXEL", "NUBE", "ROCKY", "LUNA", "ZIGGY"],
  ["ORION", "VEGA", "SATU", "NIX", "KORA", "BLITZ"],
  ["NOVA", "ATLAS", "LYRA", "RIGEL", "SOL", "IRIS"],
  ["QUASAR", "ANDRO", "ELARA", "TITAN", "HALO", "ZENITH"],
  ["PULSAR", "AURORA", "SIRIUS", "NEBULA", "MAGNA", "ASTRA"],
  ["ROBLE", "CEDRO", "SAUCE", "ARCE", "OLMO", "TEJO"],
  ["RESINA", "FÓSIL", "MIEL", "OCRE", "SOLAR", "AURUM"],
  ["NÁCAR", "OSTRA", "MAREA", "CORAL", "PERLA", "ABISMO"],
] as const;

export type LeagueRival = {
  name: string; avatar: string; target: number; balanceGoal: boolean; timeGoal?: boolean;
  /** v174: the rival's reference play time (ms) — an exact score tie goes to whoever was faster. */
  timeMs?: number;
};
/** v174: drawn after the rival's other values, so names, avatars and targets stay exactly as before. */
const rivalTime = (rng: { nextInt(n: number): number }, tier: number) => Math.round((70000 + rng.nextInt(50001)) / FACTORS[tier]);

/** Matchmaking by league tier: the rival and its score depend only on game, tier and series position. */
export function leagueRival(game: GameMeta, record: LeagueRecord): LeagueRival {
  const match = record.results.length; // v218: always 0; `series` counts the matches, so the rival still rotates
  const rng = createRng(`league:${game.id}:${record.tier}:${record.series}:${match}`);
  const pool = RIVALS[record.tier];
  const name = pool[rng.nextInt(pool.length)];
  const avatar = portraitSrc(1 + rng.nextInt(16), "-s");
  if (game.resultMetric === "fictitious-balance") {
    return { name, avatar, target: BALANCE_GOALS[record.tier], balanceGoal: true, timeMs: rivalTime(rng, record.tier) };
  }
  const reference = REFERENCE[game.id] ?? game.rivalScore;
  const jitter = 0.92 + rng.nextInt(17) / 100; // 0.92–1.08
  // Time-scored games: higher tiers must be FASTER, so the target time shrinks with the tier factor.
  const lower = game.resultMetric === "reaction-time-ms";
  let target = Math.max(1, Math.round(lower ? reference / (FACTORS[record.tier] * jitter) : reference * FACTORS[record.tier] * jitter));
  if (CAP[game.id]) target = Math.min(CAP[game.id], target);
  return { name, avatar, target, balanceGoal: false, timeGoal: lower, timeMs: rivalTime(rng, record.tier) };
}

/** v218: records one match of a game; a win adds one to the game's wins and may reach the next tier (never lower). */
export function recordLeagueResult(record: LeagueRecord, won: boolean): LeagueRecord {
  const before = gameWins(record), wins = before + (won ? 1 : 0);
  const from = record.tier, to = Math.max(from, tierForWins(wins)) as LeagueTier;
  return {
    tier: to,
    wins,
    results: [],
    series: record.series + 1,
    best: Math.max(record.best, to) as LeagueTier,
    last: { change: to > from ? "up" : "stay", from, to, wins },
  };
}

export function isLeagueState(value: unknown): value is LeagueState {
  if (!value || typeof value !== "object") return false;
  return Object.values(value as Record<string, unknown>).every((r) => {
    const x = r as Partial<LeagueRecord>;
    return x && typeof x.tier === "number" && x.tier >= 0 && x.tier <= TOP_TIER && Array.isArray(x.results) && typeof x.series === "number"
      && (x.wins === undefined || (typeof x.wins === "number" && x.wins >= 0));
  });
}
