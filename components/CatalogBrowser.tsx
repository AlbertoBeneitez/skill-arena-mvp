"use client";
import UiIcon from "./UiIcon";
import { useEffect } from "react";
import { LeagueBadge } from "./LeagueResult";
import { emptyLeague, type LeagueState } from "@/lib/leagues";
import { GAMES, modeForStake, type GameMeta, type Stake, type GameId, type MatchMode } from "@/lib/games";
import styles from "./CatalogBrowser.module.css";
import { t, useI18n } from "@/lib/i18n";
import { gameName } from "@/lib/i18n/games";
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
  return (
    <section className={styles.browser} aria-label={t("catalog.aria")}>
      <div className={styles.grid}>
        {GAMES.map((game, index) => (
          <article key={game.id} className={styles.card} aria-label={gameName(game)} style={{ ["--accent" as string]: CATEGORY_ACCENTS[game.category] ?? "#9ce6e8" }}>
            <div className={styles.cover}>
              <img
                src={game.cover}
                alt=""
                width={480}
                height={330}
                // Light raster covers (~22 KB each): load them all up front so scrolling never waits.
                loading="eager"
                decoding="async"
                fetchPriority={index < 4 ? "high" : "low"}
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
        ))}
      </div>
    </section>
  );
}
