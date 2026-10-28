/**
 * Demo leagues (simulated rivals, fictitious balance): one league per game, five tiers. A series is five
 * matches in that game; 3+ wins promote, 1 or fewer wins relegate, 2 wins keep the tier. Each match is paired
 * with a simulated rival of the player's tier: its score is the target to beat. Presentation/local state only —
 * never authoritative, never used for real money or real rankings.
 */
import type { GameMeta } from "./games";
import { createRng } from "./deterministic/seeded";

export const LEAGUE_TIERS = ["bronze", "silver", "gold", "platinum", "diamond"] as const;
export type LeagueTier = 0 | 1 | 2 | 3 | 4;
export const LEAGUE_SERIES = 5;
export const LEAGUE_PROMOTE_WINS = 3;
export const LEAGUE_RELEGATE_WINS = 1;
export const LEAGUE_COLORS = ["#d08a4c", "#c9d3e0", "#f3c55a", "#7fe3ee", "#b98cff"] as const;
export const LEAGUE_ICONS = ["🥉", "🥈", "🥇", "💠", "💎"] as const;

export type LeagueRecord = {
  tier: LeagueTier;
  /** Results of the current series, oldest first (true = win). */
  results: boolean[];
  /** Completed series so far (drives the rival rotation). */
  series: number;
  best: LeagueTier;
  last?: { change: "up" | "down" | "stay"; from: LeagueTier; to: LeagueTier; wins: number };
};
export type LeagueState = Record<string, LeagueRecord>;

export const emptyLeague = (): LeagueRecord => ({ tier: 0, results: [], series: 0, best: 0 });

/** Platinum-level reference score per game (higher is better). Balance games use their own goals. */
const REFERENCE: Record<string, number> = {
  darts: 800,
  billiards: 7000,
  "tower-drop": 6200,
  "solitaire-sprint": 22500,
  "mine-grid": 6000,
  "stack-shift": 16000,
  "orb-burst": 10000,
  "precision-stack": 600000,
  "reaction-test": 15000, // accumulated ms (lower is better)
  pinball: 65000,
  "corner-sudoku": 3200,
  bowling: 180,
};
/** Score caps: the target never exceeds what a perfect run can reach. */
const CAP: Record<string, number> = {};
const FACTORS = [0.45, 0.65, 0.85, 1, 1.2] as const;
/** Balance games start with 100 chips (10 000 minor units): the goal is the closing balance. */
const BALANCE_GOALS = [10000, 11000, 12500, 15000, 20000] as const;

const RIVALS = [
  ["COMET", "PIXEL", "NUBE", "ROCKY", "LUNA", "ZIGGY"],
  ["ORION", "VEGA", "SATU", "NIX", "KORA", "BLITZ"],
  ["NOVA", "ATLAS", "LYRA", "RIGEL", "SOL", "IRIS"],
  ["QUASAR", "ANDRO", "ELARA", "TITAN", "HALO", "ZENITH"],
  ["PULSAR", "AURORA", "SIRIUS", "NEBULA", "MAGNA", "ASTRA"],
] as const;

export type LeagueRival = { name: string; avatar: string; target: number; balanceGoal: boolean; timeGoal?: boolean };

/** Matchmaking by league tier: the rival and its score depend only on game, tier and series position. */
export function leagueRival(game: GameMeta, record: LeagueRecord): LeagueRival {
  const match = record.results.length;
  const rng = createRng(`league:${game.id}:${record.tier}:${record.series}:${match}`);
  const pool = RIVALS[record.tier];
  const name = pool[rng.nextInt(pool.length)];
  const avatar = `/avatars/portrait-${String(1 + rng.nextInt(16)).padStart(2, "0")}-s.webp`;
  if (game.resultMetric === "fictitious-balance") {
    return { name, avatar, target: BALANCE_GOALS[record.tier], balanceGoal: true };
  }
  const reference = REFERENCE[game.id] ?? game.rivalScore;
  const jitter = 0.92 + rng.nextInt(17) / 100; // 0.92–1.08
  // Time-scored games: higher tiers must be FASTER, so the target time shrinks with the tier factor.
  const lower = game.resultMetric === "reaction-time-ms";
  let target = Math.max(1, Math.round(lower ? reference / (FACTORS[record.tier] * jitter) : reference * FACTORS[record.tier] * jitter));
  if (CAP[game.id]) target = Math.min(CAP[game.id], target);
  return { name, avatar, target, balanceGoal: false, timeGoal: lower };
}

/** Records one match; closes the series after five and applies promotion/relegation. */
export function recordLeagueResult(record: LeagueRecord, won: boolean): LeagueRecord {
  const results = [...record.results, won];
  if (results.length < LEAGUE_SERIES) return { ...record, results, last: undefined };
  const wins = results.filter(Boolean).length;
  const from = record.tier;
  let to = from;
  if (wins >= LEAGUE_PROMOTE_WINS && from < 4) to = (from + 1) as LeagueTier;
  else if (wins <= LEAGUE_RELEGATE_WINS && from > 0) to = (from - 1) as LeagueTier;
  return {
    tier: to,
    results: [],
    series: record.series + 1,
    best: Math.max(record.best, to) as LeagueTier,
    last: { change: to > from ? "up" : to < from ? "down" : "stay", from, to, wins },
  };
}

export function isLeagueState(value: unknown): value is LeagueState {
  if (!value || typeof value !== "object") return false;
  return Object.values(value as Record<string, unknown>).every((r) => {
    const x = r as Partial<LeagueRecord>;
    return x && typeof x.tier === "number" && x.tier >= 0 && x.tier <= 4 && Array.isArray(x.results) && typeof x.series === "number";
  });
}
