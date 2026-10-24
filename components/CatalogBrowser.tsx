"use client";
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
};
/** Presentation and discovery only. The common registry remains the sole catalogue. */
export default function CatalogBrowser(props: Props) {
  useI18n();
  return (
    <section className={styles.browser} aria-label={t("catalog.aria")}>
      <div className={styles.grid}>
        {GAMES.map((game) => (
          <article key={game.id} className={styles.card} aria-label={gameName(game)} style={{ ["--accent" as string]: CATEGORY_ACCENTS[game.category] ?? "#9ce6e8" }}>
            <div className={styles.cover}>
              <img
                src={game.cover}
                alt=""
                width={480}
                height={330}
                loading="lazy"
                decoding="async"
              />
              {!props.serverOnly && (props.modes?.[game.id] ?? modeForStake(game, props.stake, props.nextTurn)) ===
                "existing" && (
                <button
                  type="button"
                  className={styles.ghost}
                  onClick={props.onToggleGhost}
                  aria-pressed={props.ghostEnabled}
                  aria-label={t("catalog.ghost")}
                >
                  👻
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
