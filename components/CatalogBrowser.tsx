"use client";
import { GAMES, modeForStake, type GameMeta, type Stake, type GameId, type MatchMode } from "@/lib/games";
import styles from "./CatalogBrowser.module.css";
const ACCENTS: Record<string, string> = {
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
  return (
    <section className={styles.browser} aria-label="Catálogo de juegos">
      <div className={styles.grid}>
        {GAMES.map((game) => (
          <article key={game.id} className={styles.card} aria-label={game.name} style={{ ["--accent" as string]: ACCENTS[game.category] ?? "#9ce6e8" }}>
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
                  aria-label="Mostrar u ocultar fantasma"
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
              aria-label={`Jugar a ${game.name}`}
              aria-busy={props.startingGameId === game.id}
              onClick={() => props.onPlay(game)}
            >
              {props.startingGameId === game.id
                ? "ENTRANDO…"
                : props.stake === 0
                  ? game.name
                  : `${game.name} · ${props.stake} ${props.stake === 1 ? "FICHA" : "FICHAS"}`}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
