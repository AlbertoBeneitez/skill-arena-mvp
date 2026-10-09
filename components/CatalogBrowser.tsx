"use client";
import { useMemo, useState } from "react";
import { GAMES, modeForStake, type GameMeta, type Stake } from "@/lib/games";
import styles from "./CatalogBrowser.module.css";
type Props = {
  stake: Stake;
  balance: number;
  nextTurn: "create" | "existing";
  startingGameId: string | null;
  ghostEnabled: boolean;
  onToggleGhost(): void;
  onPlay(game: GameMeta): void;
};
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .trim();
/** Presentation and discovery only. The common registry remains the sole catalogue. */
export default function CatalogBrowser(props: Props) {
  const [query, setQuery] = useState("");
  const games = useMemo(() => {
    const q = normalize(query);
    return GAMES.filter(
      (g) =>
        !q || normalize(`${g.name} ${g.category} ${g.skillLabel}`).includes(q),
    );
  }, [query]);
  return (
    <section className={styles.browser} aria-label="Catálogo de juegos">
      <div className={styles.searchRow}>
        <label className={styles.searchLabel} htmlFor="catalog-search">
          Encuentra tu próximo reto
        </label>
        <div className={styles.searchField}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <circle cx="10" cy="10" r="6" />
            <path d="m15 15 5 5" />
          </svg>
          <input
            id="catalog-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={80}
            placeholder="Buscar juego o habilidad"
            autoComplete="off"
            aria-describedby="catalog-count"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Limpiar búsqueda"
            >
              ×
            </button>
          )}
        </div>
        <p id="catalog-count" className={styles.count} role="status">
          {games.length} {games.length === 1 ? "juego" : "juegos"}
          {query ? " encontrados" : " para explorar"}
        </p>
      </div>
      {games.length === 0 ? (
        <div className={styles.empty}>
          <strong>No encontramos ese reto</strong>
          <p>Prueba con «billar», «puntería» o el nombre de otro juego.</p>
          <button type="button" onClick={() => setQuery("")}>
            Ver todos los juegos
          </button>
        </div>
      ) : (
        <div className={styles.grid}>
          {games.map((game) => (
            <article key={game.id} className={styles.card} aria-label={game.name}>
              <div className={styles.cover}>
                <img
                  src={game.cover}
                  alt=""
                  width={480}
                  height={330}
                  loading="lazy"
                  decoding="async"
                />
                {modeForStake(game, props.stake, props.nextTurn) ===
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
                  props.stake > props.balance || props.startingGameId !== null
                }
                aria-label={`Jugar a ${game.name}`}
                aria-busy={props.startingGameId === game.id}
                onClick={() => props.onPlay(game)}
              >
                {props.startingGameId === game.id
                  ? "ENTRANDO…"
                  : props.stake === 0
                    ? "JUGAR"
                    : `JUGAR · ${props.stake}€ FICTICIOS`}
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
