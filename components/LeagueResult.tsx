"use client";
import { formatNumber, t, useI18n, type MessageKey } from "@/lib/i18n";
import { LEAGUE_COLORS, LEAGUE_ICONS, LEAGUE_SERIES, type LeagueRecord, type LeagueRival, type LeagueTier } from "@/lib/leagues";

const tierName = (tier: LeagueTier) => t(`league.tier${tier}` as MessageKey);

/** Series dots: wins, losses and the matches still to play. */
export function LeagueDots({ results, size = 10 }: { results: readonly boolean[]; size?: number }) {
  return (
    <span className="leagueDots" aria-hidden="true">
      {Array.from({ length: LEAGUE_SERIES }, (_, i) => (
        <i key={i} className={i < results.length ? (results[i] ? "w" : "l") : ""} style={{ width: size, height: size }} />
      ))}
    </span>
  );
}

/** Compact league chip for catalogue cards. */
export function LeagueBadge({ record }: { record: LeagueRecord }) {
  useI18n();
  return (
    <span className="leagueBadge" style={{ ["--tier" as string]: LEAGUE_COLORS[record.tier] }}
      aria-label={t("league.badgeAria", { tier: tierName(record.tier), n: record.results.length, total: LEAGUE_SERIES })}>
      <b aria-hidden="true">{LEAGUE_ICONS[record.tier]}</b>
      <span>{tierName(record.tier)}</span>
      <LeagueDots results={record.results} size={6} />
    </span>
  );
}

/** League outcome under the match result: rival, series progress, promotion/relegation. */
export default function LeagueResult({ outcome }: { outcome: { won: boolean; record: LeagueRecord; rival: LeagueRival; score: number } }) {
  useI18n();
  const { won, record, rival } = outcome, last = record.last;
  const shownTier = last ? last.from : record.tier;
  const results = last ? Array.from({ length: LEAGUE_SERIES }, (_, i) => i < last.wins) : record.results;
  const target = rival.balanceGoal ? t("league.goalChips", { n: formatNumber(rival.target / 100) }) : formatNumber(rival.target);
  return (
    <section className={`leagueResult ${won ? "won" : "lost"} ${last ? `change-${last.change}` : ""}`} style={{ ["--tier" as string]: LEAGUE_COLORS[shownTier] }} aria-label={t("league.title")}>
      <header>
        <span className="leagueTier"><b aria-hidden="true">{LEAGUE_ICONS[shownTier]}</b>{t("league.leagueOf", { tier: tierName(shownTier) })}</span>
        <LeagueDots results={results} />
      </header>
      <div className="leagueVs">
        <img src={rival.avatar} alt="" width={34} height={34} />
        <span><b>{rival.name}</b><small>{target}</small></span>
        <strong>{won ? t("league.beat", { name: rival.name }) : t("league.lostTo", { name: rival.name })}</strong>
      </div>
      {last ? (
        <p className="leagueChange" role="status">
          {last.change === "up" ? t("league.up", { tier: tierName(last.to) })
            : last.change === "down" ? t("league.down", { tier: tierName(last.to) })
            : last.to === 4 && last.wins >= 3 ? t("league.top", { tier: tierName(last.to) })
            : t("league.stay", { tier: tierName(last.to) })}
          <small>{t("league.seriesWins", { n: last.wins, total: LEAGUE_SERIES })}</small>
        </p>
      ) : (
        <p className="leagueProgress">{t("league.progress", { n: record.results.length, total: LEAGUE_SERIES, wins: record.results.filter(Boolean).length })}</p>
      )}
    </section>
  );
}
