"use client";
/** v218 · The league of a game after a match: tier, wins in that game and what the next tier needs. */
import { formatNumber, t, useI18n, type MessageKey } from "@/lib/i18n";
import { LEAGUE_COLORS, LEAGUE_ICONS, LEAGUE_TIERS, tierProgress, type LeagueRecord, type LeagueRival, type LeagueTier } from "@/lib/leagues";

const tierName = (tier: LeagueTier) => t(`league.tier${tier}` as MessageKey);
export const winsLabel = (n: number) => (n === 1 ? t("league.winsOne") : t("league.winsN", { n: formatNumber(n) }));
/** «Faltan N victorias para Oro», or the top tier. */
export function nextTierLabel(record: LeagueRecord) {
  const p = tierProgress(record);
  if (p.next === null) return t("league.maxTier", { tier: tierName(p.tier) });
  return p.missing === 1 ? t("league.toNextOne", { tier: tierName(p.next) }) : t("league.toNext", { n: p.missing, tier: tierName(p.next) });
}
/** The road bronze → diamond: past tiers full, the current one filled by its wins. */
export function TierRoad({ record }: { record: LeagueRecord }) {
  const p = tierProgress(record);
  return (
    <span className="tierRoad" aria-hidden="true">
      {LEAGUE_TIERS.map((_, tier) => (
        <i key={tier} style={{ ["--c" as string]: LEAGUE_COLORS[tier], ["--f" as string]: tier < p.tier ? 1 : tier === p.tier ? (p.next === null ? 1 : p.fill) : 0 }} />
      ))}
    </span>
  );
}

/** League outcome under the match result: rival, wins in the game, a new tier when reached. */
export default function LeagueResult({ outcome }: { outcome: { won: boolean; record: LeagueRecord; rival: LeagueRival; score: number } }) {
  useI18n();
  const { won, record, rival } = outcome, last = record.last, up = last?.change === "up";
  const target = rival.balanceGoal ? t("league.goalChips", { n: formatNumber(rival.target / 100) }) : rival.timeGoal ? t("common.ms", { n: formatNumber(rival.target) }) : formatNumber(rival.target);
  const wins = tierProgress(record).wins;
  return (
    <section className={`leagueResult ${won ? "won" : "lost"} ${up ? "change-up" : ""}`} style={{ ["--tier" as string]: LEAGUE_COLORS[record.tier] }} aria-label={t("league.title")}>
      <header>
        <span className="leagueTier"><b aria-hidden="true">{LEAGUE_ICONS[record.tier]}</b>{t("league.leagueOf", { tier: tierName(record.tier) })}</span>
        <span className="leagueWins">{winsLabel(wins)}</span>
      </header>
      <div className="leagueVs">
        <img src={rival.avatar} alt="" width={34} height={34} />
        <span><b>{rival.name}</b><small>{target}</small></span>
        <strong>{won ? t("league.beat", { name: rival.name }) : t("league.lostTo", { name: rival.name })}</strong>
      </div>
      <TierRoad record={record} />
      <p className={up ? "leagueChange" : "leagueProgress"} role={up ? "status" : undefined}>
        {up && last ? t("league.up", { tier: tierName(last.to) }) : nextTierLabel(record)}
        {up && <small>{nextTierLabel(record)}</small>}
      </p>
    </section>
  );
}
