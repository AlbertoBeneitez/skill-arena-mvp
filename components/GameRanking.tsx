"use client";
import { useId, useMemo, useState } from "react";
import { GAMES, POPULAR_COUNT, bestScoreKey, compareScores, lowerScoreWins, type GameMeta } from "@/lib/games";
import { formatScore } from "@/lib/scoreFormat";
import { t, useI18n, type MessageKey } from "@/lib/i18n";
import { gameName } from "@/lib/i18n/games";
import { createRng } from "@/lib/deterministic/seeded";
import { emptyLeague, leagueRival, LEAGUE_COLORS, LEAGUE_ICONS, type LeagueRecord, type LeagueState, type LeagueTier } from "@/lib/leagues";
import GlobalRanking from "./GlobalRanking";
import GamesIncomeRanking from "./GamesIncomeRanking";
import { DEFAULT_RANKING_PERIOD, RANKING_PERIODS, type RankingPeriod } from "@/lib/rankingPeriod";
import { portraitSrc } from "@/lib/avatars";
import UiIcon from "./UiIcon";
import { SAMPLE_RANKING_NAMES } from "@/lib/demo/sampleNames";
import type { Platform } from "@/lib/platform";
import rp from "./RankingPicker.module.css";

type Row = { id: string; name: string; avatar: string; score: number; tier: LeagueTier; you?: boolean };

const NAMES = SAMPLE_RANKING_NAMES;

/** Sample leaderboard per game (datos de ejemplo): deterministic, spread over the five league tiers. */
function sampleRows(game: GameMeta, platform: Platform, period: RankingPeriod): Row[] {
  // v179: each platform has its own leaderboard (mobile keeps its earlier sample exactly). v189: and each period.
  const base0 = platform === "mobile" ? `game-ranking:${game.id}` : `game-ranking:${platform}:${game.id}`;
  const rng = createRng(period === "all" ? base0 : `${base0}:${period}`);
  return NAMES.map((name, i) => {
    const tier = (4 - Math.min(4, Math.floor(i / 6))) as LeagueTier;
    const record: LeagueRecord = { ...emptyLeague(), tier, series: i, results: [] };
    const base = leagueRival(game, record).target;
    const spread = (1.12 - (i % 6) * 0.035) * (0.97 + rng.nextInt(7) / 100);
    // Time-scored games: a stronger player has a SMALLER time.
    const score = Math.round(lowerScoreWins(game) ? base / spread : base * spread);
    return { id: `sample-${i}`, name, avatar: portraitSrc(1 + ((i * 7) % 16), "-s"), score, tier };
  }).sort((a, b) => compareScores(game)(a.score, b.score));
}

export function scoreText(game: GameMeta, score: number) {
  return formatScore(score, game.resultMetric);
}

export function GameRanking({ game, best, league, playerName, avatarSrc, platform = "mobile", period = "all" }: { game: GameMeta; best?: number; league: LeagueRecord; playerName: string; avatarSrc: string; platform?: Platform; period?: RankingPeriod }) {
  useI18n();
  const rows = useMemo(() => {
    const list = sampleRows(game, platform, period);
    if (best !== undefined) list.push({ id: "you", name: playerName || t("common.you"), avatar: avatarSrc, score: best, tier: league.tier, you: true });
    return list.sort((a, b) => compareScores(game)(a.score, b.score) || (a.you ? -1 : 1));
  }, [game, best, league.tier, playerName, avatarSrc, platform, period]);
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
          {best !== undefined && <>{scoreText(game, best)}<small>{t("ranking.bestScore")} · #{yourPosition}</small></>}
        </strong>
      </div>
      <div className="rankingTableWrap">
        <table className="rankingTable gameRankingTable">
          <caption>{t("ranking.gameOf", { game: gameName(game) })}</caption>
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

const fold = (v: string) => v.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/**
 * v178 · One picker instead of two tabs: it reads «Global» until a game is chosen. Tapping it opens a search; before
 * anything is typed it lists the most popular games (the catalogue's popularity order), and typing finds any game.
 */
function RankingPicker({ value, onChange }: { value: string; onChange(id: string): void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const q = fold(query.trim());
  const options = [
    ...(!q || fold(t("ranking.tabGlobal")).includes(q) ? [{ id: "global", label: t("ranking.tabGlobal") }] : []),
    ...(q ? GAMES.filter((g) => fold(gameName(g)).includes(q)) : GAMES.slice(0, POPULAR_COUNT)).map((g) => ({ id: g.id, label: gameName(g) })),
  ];
  const current = value === "global" ? t("ranking.tabGlobal") : gameName(GAMES.find((g) => g.id === value) ?? GAMES[0]);
  const close = () => { setOpen(false); setQuery(""); setActive(0); };
  const pick = (id: string) => { onChange(id); close(); };
  return (
    <div className={rp.picker}>
      {!open ? (
        <button type="button" className={rp.field} aria-haspopup="listbox" aria-expanded={false} onClick={() => setOpen(true)}>
          <span>{current}</span>
          <UiIcon name="chevronDown" size={18} />
        </button>
      ) : (
        <div className={rp.open}>
          <label className={rp.search}>
            <UiIcon name="search" size={18} />
            <input
              autoFocus type="search" value={query} placeholder={t("group.searchGames")} aria-label={t("group.searchGames")}
              role="combobox" aria-expanded="true" aria-controls={listId} aria-activedescendant={options[active] ? `${listId}-${options[active].id}` : undefined}
              onChange={(e) => { setQuery(e.target.value); setActive(0); }}
              onKeyDown={(e) => {
                if (e.key === "Escape") close();
                else if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(options.length - 1, i + 1)); }
                else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
                else if (e.key === "Enter" && options[active]) { e.preventDefault(); pick(options[active].id); }
              }}
            />
            <button type="button" className={rp.close} aria-label={t("common.close")} onClick={close}><UiIcon name="close" size={16} /></button>
          </label>
          {!q && <p className={rp.hint}>{t("ranking.popular")}</p>}
          <ul id={listId} role="listbox" aria-label={t("ranking.title")} className={rp.list}>
            {options.map((o, i) => (
              <li key={o.id} id={`${listId}-${o.id}`} role="option" aria-selected={o.id === value} data-active={i === active || undefined}
                onPointerDown={(e) => e.preventDefault()} onClick={() => pick(o.id)}>
                {o.id === "global" ? <span className={rp.globe}><UiIcon name="globe" size={18} /></span>
                  : <img src={GAMES.find((g) => g.id === o.id)?.cover} alt="" width={32} height={32} loading="lazy" />}
                <span>{o.label}</span>
                {o.id === value && <UiIcon name="check" size={16} />}
              </li>
            ))}
            {!options.length && <li className={rp.none}>{t("group.noGamesFound")}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Ranking screen. v188: two kinds — «Jugadores» (the global net-profit ranking by default, or one game's leaderboard,
 * through one picker) and «Juegos» (income generated by each game, GamesIncomeRanking).
 */
export default function RankingHub({ bestScores, leagues, playerName, avatarSrc, showLeagues, platform = "mobile" }: { bestScores: Record<string, number>; leagues: LeagueState; playerName: string; avatarSrc: string; showLeagues: boolean; platform?: Platform }) {
  useI18n();
  const [kind, setKind] = useState<"players" | "games">("players");
  const [period, setPeriod] = useState<RankingPeriod>(DEFAULT_RANKING_PERIOD);
  const [view, setView] = useState<string>("global");
  const game = GAMES.find((g) => g.id === view);
  return (
    <div className="rankingHub">
      <div className="rankingKinds" role="group" aria-label={t("ranking.title")}>
        <button type="button" aria-pressed={kind === "players"} onClick={() => setKind("players")}>{t("ranking.tabPlayers")}</button>
        <button type="button" aria-pressed={kind === "games"} onClick={() => setKind("games")}>{t("ranking.tabGames")}</button>
      </div>
      {/* v189: every ranking can be read over one week, one month, six months, one year or all time. */}
      <div className="rankingPeriods" role="radiogroup" aria-label={t("ranking.periodAria")}>
        {RANKING_PERIODS.map((p) => (
          <button key={p} type="button" role="radio" aria-checked={period === p} aria-label={t(`ranking.periodLong.${p}` as MessageKey)} onClick={() => setPeriod(p)}>
            {t(`ranking.period.${p}` as MessageKey)}
          </button>
        ))}
      </div>
      {kind === "games" ? <GamesIncomeRanking period={period} /> : <>
        <RankingPicker value={view} onChange={setView} />
        {/* v179: phones and computers rank apart (v224: without saying so on screen, owner). */}
        {!game ? <GlobalRanking embedded platform={platform} period={period} /> : (
          <>
            <GameRanking platform={platform} period={period} game={game} best={bestScores[bestScoreKey(game)]} league={showLeagues ? leagues[game.id] ?? emptyLeague() : emptyLeague()} playerName={playerName} avatarSrc={avatarSrc} />
          </>
        )}
      </>}
    </div>
  );
}
