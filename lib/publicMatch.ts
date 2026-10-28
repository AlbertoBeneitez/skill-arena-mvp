/** Platform policy; archived game rules and hashes are unchanged. */
export const PUBLIC_MATCH_POLICY = "forfeit-on-disconnect-v1";
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
