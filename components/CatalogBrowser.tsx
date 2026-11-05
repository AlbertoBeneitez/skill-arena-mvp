"use client";
import UiIcon from "./UiIcon";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { LeagueBadge } from "./LeagueResult";
import { emptyLeague, type LeagueState } from "@/lib/leagues";
import { CATALOG_SHELVES, GAMES, POPULAR_COUNT, gameShelf, isNewGame, modeForStake, type GameMeta, type Stake, type GameId, type MatchMode } from "@/lib/games";
import styles from "./CatalogBrowser.module.css";
import { t, useI18n } from "@/lib/i18n";
import { gameName } from "@/lib/i18n/games";
import { PUBLISHED_API, isNewPublished, parsePublished, publishedCoverUrl, type PublishedGame } from "@/lib/studio/published";
// v135: the proposal form loads only when a studio opens it.
const GameProposal = dynamic(() => import("./GameProposal"), { ssr: false });
// v147: published studio games (training) and their player.
const ExternalGamePlayer = dynamic(() => import("./ExternalGamePlayer"), { ssr: false });
/** v136: one edge colour per catalogue row, so every game of the same kind carries the same colour (also in
 * Populares and Nuevos). Not ion (interactive) or gold (money). */
export const SHELF_ACCENTS: Record<string, string> = {
  casino: "#ff6b7a", bar: "#ffa85c", mythic: "#b88cff", dynamic: "#5fd6ff", alternative: "#6ff0b0",
};
export const gameAccent = (game: GameMeta) => SHELF_ACCENTS[gameShelf(game)] ?? "#9ce6e8";
/** v143: the colour of each row's title tick (the two curated rows have their own: ion for Populares, pink for Nuevos). */
const rowAccent = (key: string) => SHELF_ACCENTS[key] ?? (key === "new" ? "#ff9ad8" : "#9ce6e8");
type Props = {
  stake: Stake;
  serverOnly?: boolean;
  modes?: Partial<Record<GameId,MatchMode>>;
  balance: number;
  nextTurn: "create" | "existing";
  startingGameId: string | null;
  ghostEnabled: boolean;
  onToggleGhost(): void;
  onPlay(game: GameMeta): void;
  /** Demo league per game (absent in server-backed mode). */
  leagues?: LeagueState;
};
const prefetched = new Set<string>();
/** Warm a game's code so opening it does not wait for the download (safe to call repeatedly). */
function prefetchGame(game: GameMeta) {
  if (prefetched.has(game.id)) return;
  prefetched.add(game.id);
  void game.loadComponent().catch(() => prefetched.delete(game.id));
}
/** Presentation and discovery only. The common registry remains the sole catalogue. */
export default function CatalogBrowser(props: Props) {
  const [proposing, setProposing] = useState(false);
  const [external, setExternal] = useState<PublishedGame[]>([]);
  const [playing, setPlaying] = useState<PublishedGame | null>(null);
  useI18n();
  // v147: studio games the owner has approved join their row (and Nuevos while recent); training only.
  useEffect(() => {
    let live = true;
    fetch(PUBLISHED_API).then((r) => (r.ok ? r.json() : null)).then((j) => { if (live) setExternal(parsePublished(j)); }).catch(() => {});
    return () => { live = false; };
  }, []);
  // While the player browses, download every game's code in the background, one at a time on idle.
  useEffect(() => {
    let cancelled = false, index = 0, handle = 0;
    const idle = (cb: () => void) =>
      typeof window.requestIdleCallback === "function" ? window.requestIdleCallback(cb, { timeout: 1500 }) : window.setTimeout(cb, 200);
    const next = () => {
      if (cancelled || index >= GAMES.length) return;
      prefetchGame(GAMES[index++]);
      handle = idle(next);
    };
    handle = idle(next);
    return () => {
      cancelled = true;
      if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
    };
  }, []);
  // v130: rows by kind of game, each ordered by popularity (GAMES order), "Populares" first; rows scroll sideways.
  // v132: "Nuevos" (recently added) follows "Populares".
  const now = Date.now();
  const rows: { key: "popular" | "new" | (typeof CATALOG_SHELVES)[number]; games: GameMeta[]; studio: PublishedGame[] }[] = [
    { key: "popular" as const, games: GAMES.slice(0, POPULAR_COUNT), studio: [] },
    { key: "new" as const, games: GAMES.filter((game) => isNewGame(game, now)), studio: external.filter((g) => isNewPublished(g, now)) },
    ...CATALOG_SHELVES.map((key) => ({ key, games: GAMES.filter((game) => gameShelf(game) === key), studio: external.filter((g) => g.shelf === key) })),
  ].filter((r) => r.games.length + r.studio.length > 0);
  const renderStudioCard = (row: string, game: PublishedGame, index: number) => (
    <article key={`${row}-studio-${game.id}`} role="listitem" className={styles.card} aria-label={game.game} style={{ ["--accent" as string]: SHELF_ACCENTS[game.shelf] ?? "#9ce6e8", ["--i" as string]: index }}>
      <div className={styles.cover}>
        <img src={publishedCoverUrl(game)} alt="" width={480} height={330} loading="lazy" decoding="async" />
        <span className={styles.studioBadge}>{t("studio.ext.badge")}</span>
      </div>
      <button className={styles.play} type="button" disabled={props.startingGameId !== null} aria-label={t("catalog.play", { game: game.game })} onClick={() => setPlaying(game)}>
        {game.game}
      </button>
    </article>
  );
  const renderCard = (row: string, game: GameMeta, index: number) => (
    <article key={`${row}-${game.id}`} role="listitem" className={styles.card} aria-label={gameName(game)} style={{ ["--accent" as string]: gameAccent(game), ["--i" as string]: index }}>
      <div className={styles.cover}>
        <img
          src={game.cover}
          alt=""
          width={480}
          height={330}
          // Light raster covers (~22 KB each): load them all up front so scrolling never waits.
          loading="eager"
          decoding="async"
          fetchPriority={row === "popular" && index < 3 ? "high" : "low"}
        />
        {props.leagues && <LeagueBadge record={props.leagues[game.id] ?? emptyLeague()} />}
        {!props.serverOnly && (props.modes?.[game.id] ?? modeForStake(game, props.stake, props.nextTurn)) ===
          "existing" && (
          <button
            type="button"
            className={styles.ghost}
            onClick={props.onToggleGhost}
            aria-pressed={props.ghostEnabled}
            aria-label={t("catalog.ghost")}
          >
            <UiIcon name="ghost" size={20} />
          </button>
        )}
      </div>
      <button
        className={styles.play}
        type="button"
        disabled={
          props.stake > props.balance || props.startingGameId !== null || (props.serverOnly === true && props.stake > 0 && game.competition.verification !== "server-replay")
        }
        aria-label={t("catalog.play", { game: gameName(game) })}
        aria-busy={props.startingGameId === game.id}
        onPointerDown={() => prefetchGame(game)}
        onClick={() => props.onPlay(game)}
      >
        {props.startingGameId === game.id
          ? t("catalog.entering")
          : props.stake === 0
            ? gameName(game)
            : t("catalog.playStake", { game: gameName(game), n: props.stake })}
      </button>
    </article>
  );
  return (
    <section className={styles.browser} aria-label={t("catalog.aria")}>
      {rows.map((r) => (
        <section key={r.key} className={styles.row} aria-labelledby={`shelf-${r.key}`} style={{ ["--accent" as string]: rowAccent(r.key) }}>
          <h2 id={`shelf-${r.key}`} className={styles.rowTitle}>{t(`catalog.shelf.${r.key}`)}</h2>
          <div className={styles.track} role="list">
            {r.games.map((game, index) => renderCard(r.key, game, index))}
            {r.studio.map((game, index) => renderStudioCard(r.key, game, r.games.length + index))}
          </div>
        </section>
      ))}
      <section className={styles.studio} aria-label={t("studio.title")}>
        <button type="button" className={styles.studioOpen} onClick={() => setProposing(true)}>{t("studio.open")}</button>
      </section>
      {proposing && <GameProposal onClose={() => setProposing(false)} />}
      {playing && <ExternalGamePlayer game={playing} onClose={() => setPlaying(null)} />}
    </section>
  );
}
