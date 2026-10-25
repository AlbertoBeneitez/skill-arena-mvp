"use client";
import { useMemo, useState } from "react";
import { GAMES, compareScores, type GameMeta } from "@/lib/games";
import { formatNumber, t, useI18n, type MessageKey } from "@/lib/i18n";
import { gameName } from "@/lib/i18n/games";
import { createRng } from "@/lib/deterministic/seeded";
import { emptyLeague, leagueRival, LEAGUE_COLORS, LEAGUE_ICONS, type LeagueRecord, type LeagueState, type LeagueTier } from "@/lib/leagues";
import GlobalRanking from "./GlobalRanking";

type Row = { id: string; name: string; avatar: string; score: number; tier: LeagueTier; you?: boolean };

const NAMES = [
  "Kairo", "Mika", "Zane", "Ayla", "Dario", "Noor", "Ilya", "Sora", "Teo", "Yara", "Lev", "Nadia", "Omar", "Priya",
  "Ren", "Sven", "Tala", "Uma", "Vik", "Wen", "Xio", "Yusuf", "Zoe", "Aiko", "Bruno", "Chloé", "Dev", "Elif", "Farah", "Gael",
];

/** Sample leaderboard per game (datos de ejemplo): deterministic, spread over the five league tiers. */
function sampleRows(game: GameMeta): Row[] {
  const rng = createRng(`game-ranking:${game.id}`);
  return NAMES.map((name, i) => {
    const tier = (4 - Math.min(4, Math.floor(i / 6))) as LeagueTier;
    const record: LeagueRecord = { ...emptyLeague(), tier, series: i, results: [] };
    const base = leagueRival(game, record).target;
    const spread = (1.12 - (i % 6) * 0.035) * (0.97 + rng.nextInt(7) / 100);
    // Time-scored games: a stronger player has a SMALLER time.
    const score = Math.round(game.resultMetric === "reaction-time-ms" ? base / spread : base * spread);
    return { id: `sample-${i}`, name, avatar: `/avatars/portrait-${String(1 + ((i * 7) % 16)).padStart(2, "0")}-s.webp`, score, tier };
  }).sort((a, b) => compareScores(game)(a.score, b.score));
}

function scoreText(game: GameMeta, score: number) {
  if (game.resultMetric === "fictitious-balance") return t("common.chips", { n: formatNumber(score / 100) });
  if (game.resultMetric === "reaction-time-ms") return t("common.ms", { n: formatNumber(score) });
  return formatNumber(score);
}

export function GameRanking({ game, best, league, playerName, avatarSrc }: { game: GameMeta; best?: number; league: LeagueRecord; playerName: string; avatarSrc: string }) {
  useI18n();
  const rows = useMemo(() => {
    const list = sampleRows(game);
    if (best !== undefined) list.push({ id: "you", name: playerName || t("common.you"), avatar: avatarSrc, score: best, tier: league.tier, you: true });
    return list.sort((a, b) => compareScores(game)(a.score, b.score) || (a.you ? -1 : 1));
  }, [game, best, league.tier, playerName, avatarSrc]);
  const yourPosition = rows.findIndex((r) => r.you) + 1;
  return (
    <section className="gameRanking" aria-label={t("ranking.gameOf", { game: gameName(game) })}>
      <div className="gameRankingYou" style={{ ["--tier" as string]: LEAGUE_COLORS[league.tier] }}>
        <img src={avatarSrc} alt="" width={44} height={44} />
        <span>
          <b>{playerName || t("common.you")}</b>
          <small>{LEAGUE_ICONS[league.tier]} {t("league.leagueOf", { tier: t(`league.tier${league.tier}` as MessageKey) })}</small>
        </span>
        <strong>
          {best !== undefined ? <>{scoreText(game, best)}<small>{t("ranking.bestScore")} · #{yourPosition}</small></> : <small>{t("ranking.noScore")}</small>}
        </strong>
      </div>
      <div className="rankingTableWrap">
        <table className="rankingTable gameRankingTable">
          <caption>{t("ranking.gameCaption", { game: gameName(game) })}</caption>
          <thead>
            <tr>
              <th scope="col">{t("ranking.position")}</th>
              <th scope="col">{t("ranking.player")}</th>
              <th scope="col">{t("ranking.league")}</th>
              <th scope="col">{t("ranking.bestScore")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className={r.you ? "you" : undefined}>
                <td>#{i + 1}</td>
                <td><span className="rankingPlayer"><img className="gameRankingAvatar" src={r.avatar} alt="" width={28} height={28} loading="lazy" /><span title={r.name}>{r.name}</span></span></td>
                <td><span className="gameRankingTier" style={{ ["--tier" as string]: LEAGUE_COLORS[r.tier] }} title={t(`league.tier${r.tier}` as MessageKey)}>{LEAGUE_ICONS[r.tier]}</span></td>
                <td className="gameRankingScore">{scoreText(game, r.score)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Ranking screen: the global net-profit ranking and one leaderboard per game. */
export default function RankingHub({ bestScores, leagues, playerName, avatarSrc, showLeagues }: { bestScores: Record<string, number>; leagues: LeagueState; playerName: string; avatarSrc: string; showLeagues: boolean }) {
  useI18n();
  const [view, setView] = useState<"global" | "game">("game");
  const [gameId, setGameId] = useState<string>(GAMES[0].id);
  const game = GAMES.find((g) => g.id === gameId) ?? GAMES[0];
  return (
    <div className="rankingHub">
      <div className="rankingViewTabs" role="tablist" aria-label={t("ranking.title")}>
        <button type="button" role="tab" aria-selected={view === "game"} onClick={() => setView("game")}>{t("ranking.tabGame")}</button>
        <button type="button" role="tab" aria-selected={view === "global"} onClick={() => setView("global")}>{t("ranking.tabGlobal")}</button>
      </div>
      {view === "global" ? <GlobalRanking embedded /> : (
        <>
          <label className="gameRankingPick">
            <span>{t("ranking.gamePick")}</span>
            <select value={game.id} onChange={(e) => setGameId(e.target.value)}>
              {GAMES.map((g) => <option key={g.id} value={g.id}>{gameName(g)}</option>)}
            </select>
          </label>
          <GameRanking game={game} best={bestScores[game.id]} league={showLeagues ? leagues[game.id] ?? emptyLeague() : emptyLeague()} playerName={playerName} avatarSrc={avatarSrc} />
          <p className="rankingNote">{t("ranking.gameNote")}</p>
        </>
      )}
    </div>
  );
}
