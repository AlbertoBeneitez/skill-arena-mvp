/** v189 · Ranking periods (owner, 13-nov): one week, one month, six months, one year and all time. */
export const RANKING_PERIODS = ["1w", "1m", "6m", "1y", "all"] as const;
export type RankingPeriod = (typeof RANKING_PERIODS)[number];
export const DEFAULT_RANKING_PERIOD: RankingPeriod = "1m";
