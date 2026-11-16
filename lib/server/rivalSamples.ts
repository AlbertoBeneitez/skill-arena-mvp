/**
 * v199 · Scores of other players' verified matches, for the invented rivals of an offline group. Only the score and
 * time travel: no player, account, match id or date. Same platform only (phones never meet computers). The caller's
 * own matches are left out. Nothing here is authoritative: these numbers only decide sample rivals in local practice.
 */
import type { Pool } from "pg";
import type { Platform } from "@/lib/platform";

export type RivalSample = { score: number; timeMs: number | null };
export const MAX_SAMPLE_GAMES = 20;
export const MAX_SAMPLES_PER_GAME = 30;

export async function rivalSamples(pool: Pick<Pool, "query">, gameIds: readonly string[], platform: Platform, excludePlayer: string | null, perGame = MAX_SAMPLES_PER_GAME): Promise<Record<string, RivalSample[]>> {
  const games = [...new Set(gameIds)].slice(0, MAX_SAMPLE_GAMES);
  if (!games.length) return {};
  const n = Math.min(Math.max(1, Math.floor(perGame)), MAX_SAMPLES_PER_GAME);
  const { rows } = await pool.query(
    `SELECT game_id, score, time_ms FROM (
       SELECT m.game_id, (a.response ->> 'score')::double precision AS score, (a.response ->> 'time_ms')::double precision AS time_ms,
              row_number() OVER (PARTITION BY m.game_id ORDER BY random()) AS k
         FROM arena_public_attempts a
         JOIN arena_public_matches pm USING (match_id)
         JOIN arena_matches m USING (match_id)
        WHERE a.state = 'verified' AND a.response ->> 'authoritative_source' = 'SERVER_REPLAY'
          AND m.game_id = ANY($1::text[]) AND pm.platform = $2
          AND ($3::text IS NULL OR a.player_id <> $3)
          AND jsonb_typeof(a.response -> 'score') = 'number'
     ) s WHERE k <= $4`,
    [games, platform, excludePlayer, n]);
  const out: Record<string, RivalSample[]> = {};
  for (const r of rows) {
    const score = Number(r.score);
    if (!Number.isFinite(score) || score < 0) continue;
    const time = r.time_ms === null ? null : Number(r.time_ms);
    (out[r.game_id as string] ??= []).push({ score, timeMs: time !== null && Number.isFinite(time) && time >= 0 ? Math.round(time) : null });
  }
  return out;
}
