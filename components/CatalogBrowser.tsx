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
// v135: the proposal form loads only when a studio opens it.
const GameProposal = dynamic(() => import("./GameProposal"), { ssr: false });
export const CATEGORY_ACCENTS: Record<string, string> = {
  PRECISIÓN: "#5fd6ff", TIMING: "#ffd04a", REACCIÓN: "#ff7a6b", MEMORIA: "#b88cff", PUZZLE: "#6ff0b0", CARTAS: "#ff8fb8", LÓGICA: "#9bf05b", CONTROL: "#ffa85c",
};
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
  useI18n();
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
  const rows: { key: "popular" | "new" | (typeof CATALOG_SHELVES)[number]; games: GameMeta[] }[] = [
    { key: "popular" as const, games: GAMES.slice(0, POPULAR_COUNT) },
    { key: "new" as const, games: GAMES.filter((game) => isNewGame(game, Date.now())) },
    ...CATALOG_SHELVES.map((key) => ({ key, games: GAMES.filter((game) => gameShelf(game) === key) })),
  ].filter((r) => r.games.length > 0);
  const renderCard = (row: string, game: GameMeta, index: number) => (
    <article key={`${row}-${game.id}`} role="listitem" className={styles.card} aria-label={gameName(game)} style={{ ["--accent" as string]: CATEGORY_ACCENTS[game.category] ?? "#9ce6e8" }}>
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
        <section key={r.key} className={styles.row} aria-labelledby={`shelf-${r.key}`}>
          <h2 id={`shelf-${r.key}`} className={styles.rowTitle}>{t(`catalog.shelf.${r.key}`)}</h2>
          <div className={styles.track} role="list">
            {r.games.map((game, index) => renderCard(r.key, game, index))}
          </div>
        </section>
      ))}
      <section className={styles.studio} aria-labelledby="studio-cta">
        <h2 id="studio-cta" className={styles.rowTitle}>{t("studio.cta")}</h2>
        <button type="button" className={styles.studioOpen} onClick={() => setProposing(true)}>{t("studio.open")}</button>
      </section>
      {proposing && <GameProposal onClose={() => setProposing(false)} />}
    </section>
  );
}
