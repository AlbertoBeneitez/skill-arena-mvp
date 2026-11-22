/** Platform policy; archived game rules and hashes are unchanged. */
export const PUBLIC_MATCH_POLICY_V1 = "forfeit-on-disconnect-v1";
/**
 * v208 · Policy for new public matches. V1 decided by `height ?? score` (higher wins) and then time, which crowned the
 * slower player in Shot Gallery (milliseconds: less is better) and ignored Stack's surface tie-break. V2 compares the
 * game's own score in the game's direction, then the faster run. Matches stored under V1 keep resolving under V1.
 */
export const PUBLIC_MATCH_POLICY = "forfeit-on-disconnect-v2";
export const PUBLIC_MATCH_POLICIES = [PUBLIC_MATCH_POLICY_V1, PUBLIC_MATCH_POLICY] as const;
/** Games whose score is a time or a cost (less is better). Mirrors `lowerScoreWins` in lib/games.ts. */
export const LOWER_SCORE_WINS_GAMES: ReadonlySet<string> = new Set(["reaction-test", "solitaire-sprint"]);

type Run = { score?: number; height?: number; time_ms?: number };
/** Winner of two verified runs under a public-match policy: "A", "B" or null (exact tie), with the deciding reason. */
export function decidePublicMatch(policy: string, gameId: string, a: Run, b: Run): { winner: "A" | "B" | null; reason: "reach" | "score" | "time" | "exact-tie" } {
  if (policy === PUBLIC_MATCH_POLICY_V1) {
    const reachA = a.height ?? a.score ?? 0, reachB = b.height ?? b.score ?? 0;
    if (reachA !== reachB) return { winner: reachA > reachB ? "A" : "B", reason: "reach" };
  } else {
    const sa = a.score ?? 0, sb = b.score ?? 0;
    if (sa !== sb) return { winner: (LOWER_SCORE_WINS_GAMES.has(gameId) ? sa < sb : sa > sb) ? "A" : "B", reason: "score" };
  }
  if (a.time_ms !== b.time_ms) return { winner: (a.time_ms ?? 0) < (b.time_ms ?? 0) ? "A" : "B", reason: "time" };
  return { winner: null, reason: "exact-tie" };
}
export const MAX_ATTEMPT_RECORD_BYTES = 512_000;
export const HEARTBEAT_MS = 5_000;
export const CONNECTION_LEASE_MS = 20_000;
export type PublicMatchView = {
  matchId: string;
  attemptId: string;
  slot: "A" | "B";
  status: "waiting" | "resolved";
  winnerSlot: "A" | "B" | null;
  policyVersion: string;
  reason?: string;
  /** Once resolved: the opponent's verified score (absent if the opponent forfeited or there is none). */
  opponentScore?: number;
};
export type PublicRecord = {
  inputs: { seq: number; tick: number; action: string }[];
  final_tick: number;
  record_kind?: "abandoned";
};
