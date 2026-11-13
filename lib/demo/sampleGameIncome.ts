/**
 * v188 · Sample data (datos de ejemplo) for the «Ranking Juegos» tab until real income exists. Real income per game is
 * its share of the month's net exchange commission by counted matches (lib/studioPayout.ts, lib/server/playCounts.ts);
 * the screen must keep saying «datos de ejemplo» while it shows these numbers.
 * Deterministic: the same months always give the same figures. Whole cents.
 */
import { createRng } from "@/lib/deterministic/seeded";

export const SAMPLE_INCOME_MONTHS = 6;

/** Income in cents for each game id, oldest month first; `popularity` is the catalogue order (most played first). */
export function sampleGameIncome(gameIds: readonly string[], lastMonth: string): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  gameIds.forEach((id, rank) => {
    const rng = createRng(`game-income:v1:${id}:${lastMonth}`);
    const base = 90_000 * Math.pow(0.8, rank) + 4_000;
    const trend = 0.02 + rng.nextFloat() * 0.1;
    out[id] = Array.from({ length: SAMPLE_INCOME_MONTHS }, (_, m) => {
      const noise = 0.85 + rng.nextFloat() * 0.3;
      return Math.round(base * (1 + trend * m) * noise);
    });
  });
  return out;
}
