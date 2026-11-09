"use client";
/**
 * v156 · The player's progress in every game, on the avatar (profile) tab: the league and its journey
 * (bronze → diamond, the current tier filled by this series' wins), the current series and the best mark.
 * Presentation only: it reads the same local league records and best marks the catalogue and the rankings use.
 */
import { GAMES, bestScoreKey, type GameMeta } from "@/lib/games";
import { formatNumber, t, useI18n, type MessageKey } from "@/lib/i18n";
import { gameName } from "@/lib/i18n/games";
import { emptyLeague, LEAGUE_COLORS, LEAGUE_ICONS, LEAGUE_PROMOTE_WINS, LEAGUE_SERIES, LEAGUE_TIERS, type LeagueState } from "@/lib/leagues";
import { LeagueDots } from "./LeagueResult";
import { scoreText } from "./GameRanking";

type Props = { leagues?: LeagueState; bestScores: Record<string, number>; onPlay(game: GameMeta): void };

export default function PlayerProgress({ leagues, bestScores, onPlay }: Props) {
  useI18n();
  const games = GAMES.filter((game) => game.enabled);
  const played = games.filter((game) => bestScores[bestScoreKey(game)] !== undefined).length;
  return (
    <section className="playerProgress" aria-label={t("progress.title")}>
      <header>
        <h2>{t("progress.title")}</h2>
        <span>{t("progress.summary", { n: formatNumber(played), total: formatNumber(games.length) })}</span>
      </header>
      <ul>
        {games.map((game) => {
          const record = leagues?.[game.id] ?? emptyLeague();
          const best = bestScores[bestScoreKey(game)];
          const wins = record.results.filter(Boolean).length;
          const tierName = t(`league.tier${record.tier}` as MessageKey);
          const fill = (tier: number) => (tier < record.tier ? 1 : tier === record.tier ? Math.min(1, wins / LEAGUE_PROMOTE_WINS) : 0);
          return (
            <li key={game.id}>
              <button type="button" onClick={() => onPlay(game)} style={{ ["--tier" as string]: LEAGUE_COLORS[record.tier] }}
                aria-label={t("progress.rowAria", { game: gameName(game), tier: tierName, mark: best !== undefined ? scoreText(game, best) : t("progress.noMark") })}>
                <img src={game.cover} alt="" width={64} height={44} loading="lazy" />
                <span className="progressMain">
                  <strong>{gameName(game)}</strong>
                  {leagues && (
                    <span className="progressTier">
                      <b aria-hidden="true">{LEAGUE_ICONS[record.tier]}</b>{tierName}
                      <LeagueDots results={record.results} size={7} />
                    </span>
                  )}
                  {leagues && (
                    <span className="progressJourney" aria-hidden="true">
                      {LEAGUE_TIERS.map((_, tier) => (
                        <i key={tier} style={{ ["--c" as string]: LEAGUE_COLORS[tier], ["--f" as string]: fill(tier) }} />
                      ))}
                    </span>
                  )}
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
      <p className="visuallyHidden">{t("progress.seriesNote", { n: LEAGUE_SERIES, wins: LEAGUE_PROMOTE_WINS })}</p>
    </section>
  );
}
