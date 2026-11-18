"use client";
/**
 * v156 · The player's progress on the avatar (profile) tab. v218 (owner): only the two games where the player ranks
 * highest — tier, then wins in the game, then matches played — each with its tier, wins, the road to the next tier and
 * the best mark. Presentation only: it reads the local league records and best marks.
 */
import { useMemo } from "react";
import { GAMES, bestScoreKey, type GameMeta } from "@/lib/games";
import { t, useI18n, type MessageKey } from "@/lib/i18n";
import { gameName } from "@/lib/i18n/games";
import { emptyLeague, gameWins, LEAGUE_COLORS, LEAGUE_ICONS, type LeagueState } from "@/lib/leagues";
import { TierRoad, nextTierLabel, winsLabel } from "./LeagueResult";
import { scoreText } from "./GameRanking";

type Props = { leagues: LeagueState; bestScores: Record<string, number>; playCounts: Record<string, number>; onPlay(game: GameMeta): void };

export default function PlayerProgress({ leagues, bestScores, playCounts, onPlay }: Props) {
  useI18n();
  const top = useMemo(() => GAMES.filter((game) => game.enabled)
    .map((game) => { const record = leagues[game.id] ?? emptyLeague(); return { game, record, wins: gameWins(record), plays: playCounts[game.id] ?? 0 }; })
    .filter((row) => row.wins > 0 || row.plays > 0 || row.record.tier > 0)
    .sort((a, b) => b.record.tier - a.record.tier || b.wins - a.wins || b.plays - a.plays)
    .slice(0, 2), [leagues, playCounts]);
  return (
    <section className="playerProgress" aria-label={t("progress.title")}>
      <header><h2>{t("progress.title")}</h2></header>
      {top.length === 0 ? <p className="progressEmpty">{t("progress.empty")}</p> : (
        <ul>
          {top.map(({ game, record, wins }) => {
            const best = bestScores[bestScoreKey(game)];
            const tierName = t(`league.tier${record.tier}` as MessageKey);
            return (
              <li key={game.id}>
                <button type="button" onClick={() => onPlay(game)} style={{ ["--tier" as string]: LEAGUE_COLORS[record.tier] }}
                  aria-label={t("progress.rowAria", { game: gameName(game), tier: tierName, mark: best !== undefined ? scoreText(game, best) : t("progress.noMark") })}>
                  <img src={game.cover} alt="" width={64} height={44} loading="lazy" />
                  <span className="progressMain">
                    <strong>{gameName(game)}</strong>
                    <span className="progressTier"><b aria-hidden="true">{LEAGUE_ICONS[record.tier]}</b>{tierName}<em>{winsLabel(wins)}</em></span>
                    <TierRoad record={record} />
                    <small className="progressNext">{nextTierLabel(record)}</small>
                  </span>
                  <span className="progressMark">
                    <small>{t("ranking.bestScore")}</small>
                    <b>{best !== undefined ? scoreText(game, best) : "—"}</b>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
