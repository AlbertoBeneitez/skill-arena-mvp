/**
 * v186 · Matches counted per game and month, for paying studios (lib/studioPayout.ts). Source: verified public
 * attempts on the server (each player's verified match is one play), never the browser. At most
 * PLAYS_PER_PLAYER_DAILY_CAP plays per player, game and UTC day count. Groups and tournaments will add their own
 * verified matches here once they run on the server.
 */
import type { Pool } from "pg";
import { PLAYS_PER_PLAYER_DAILY_CAP } from "@/lib/studioPayout";

export type MonthlyPlays = { gameId: string; plays: number; players: number };

/** "2026-11" → [start, end) in UTC, or null when the text is not a valid month. */
export function monthRange(month: string): [Date, Date] | null {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]) - 1;
  return [new Date(Date.UTC(y, mo, 1)), new Date(Date.UTC(y, mo + 1, 1))];
}

export async function monthlyPlayCounts(pool: Pool, month: string, cap = PLAYS_PER_PLAYER_DAILY_CAP): Promise<MonthlyPlays[]> {
  const range = monthRange(month);
  if (!range) throw new Error("INVALID_MONTH");
  const { rows } = await pool.query(
    `WITH plays AS (
       SELECT m.manifest->>'game_id' AS game_id, a.player_id, date_trunc('day', a.record_received_at AT TIME ZONE 'UTC') AS day
         FROM arena_public_attempts a JOIN arena_matches m USING (match_id)
        WHERE a.state = 'verified' AND a.record_received_at >= $1 AND a.record_received_at < $2
     ), capped AS (
       SELECT game_id, player_id, LEAST(count(*), $3::bigint) AS n FROM plays GROUP BY game_id, player_id, day
     )
     SELECT game_id, sum(n)::int AS plays, count(DISTINCT player_id)::int AS players
       FROM capped GROUP BY game_id ORDER BY plays DESC, game_id`,
    [range[0], range[1], cap],
  );
  return rows.map((r) => ({ gameId: r.game_id as string, plays: Number(r.plays), players: Number(r.players) }));
}
