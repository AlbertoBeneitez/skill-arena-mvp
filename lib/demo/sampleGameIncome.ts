/**
 * v188–v189 · Sample data (datos de ejemplo) for the «Ranking Juegos» tab until real income exists. Real income per game
 * is its share of the net exchange commission by counted matches (lib/studioPayout.ts, lib/server/playCounts.ts); the
 * screen must keep saying «datos de ejemplo» while it shows these numbers.
 * Deterministic and consistent between periods: a month always has the same figure, and its days add up near it.
 * Whole cents. "all" starts at SAMPLE_START.
 */
import { createRng } from "@/lib/deterministic/seeded";
import type { RankingPeriod } from "@/lib/rankingPeriod";

export const SAMPLE_START = { year: 2025, month: 0 }; // January 2025

export type IncomeSeries = { granularity: "day" | "month"; points: Date[]; perGame: Record<string, number[]> };

const monthIndex = (d: Date) => (d.getUTCFullYear() - SAMPLE_START.year) * 12 + d.getUTCMonth() - SAMPLE_START.month;

function monthIncome(id: string, rank: number, m: number) {
  const base = 90_000 * Math.pow(0.8, rank) + 4_000;
  const trend = 0.02 + createRng(`game-income:v2:${id}:trend`).nextFloat() * 0.06;
  const noise = 0.85 + createRng(`game-income:v2:${id}:m${m}`).nextFloat() * 0.3;
  return Math.round(base * (1 + trend * Math.max(0, m)) * noise);
}

/** Income in cents per game id (catalogue order = popularity), oldest point first, for the period ending `today`. */
export function sampleIncomeSeries(gameIds: readonly string[], period: RankingPeriod, today: Date): IncomeSeries {
  const day = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  if (period === "1w" || period === "1m") {
    const n = period === "1w" ? 7 : 30;
    const points = Array.from({ length: n }, (_, i) => new Date(day - (n - 1 - i) * 86_400_000));
    const perGame: Record<string, number[]> = {};
    gameIds.forEach((id, rank) => {
      perGame[id] = points.map((p) => {
        const daily = monthIncome(id, rank, monthIndex(p)) / 30;
        return Math.round(daily * (0.6 + createRng(`game-income:v2:${id}:d${p.toISOString().slice(0, 10)}`).nextFloat() * 0.8));
      });
    });
    return { granularity: "day", points, perGame };
  }
  const last = monthIndex(today);
  const count = period === "6m" ? 6 : period === "1y" ? 12 : last + 1;
  const points = Array.from({ length: count }, (_, i) => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - (count - 1 - i), 1)));
  const perGame: Record<string, number[]> = {};
  gameIds.forEach((id, rank) => { perGame[id] = points.map((p) => monthIncome(id, rank, monthIndex(p))); });
  return { granularity: "month", points, perGame };
}
