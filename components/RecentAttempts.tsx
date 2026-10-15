"use client";
import { useEffect, useState } from "react";
import { getGameDefinition } from "@/lib/games";
import type { PublicMatchView } from "@/lib/publicMatch";
import styles from "./RecentAttempts.module.css";
type Attempt = {
  attemptId: string;
  gameId: string;
  state: string;
  score?: number;
  height?: number;
  timeMs?: number;
  match: PublicMatchView;
};
function label(row: Attempt) {
  if (row.state === "forfeited" || row.state === "rejected") return "Perdida";
  if (row.state === "playing") return "En juego";
  if (row.state === "received") return "Verificando";
  if (row.match.status === "waiting") return "Esperando rival";
  if (row.match.winnerSlot === row.match.slot) return "Ganada";
  return row.match.reason === "exact-tie" ? "Empate" : "Perdida";
}
/** Own stored results only. Never updates the wallet or manufactures opponents. */
export default function RecentAttempts() {
  const [attempts, setAttempts] = useState<Attempt[] | null>(null),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const r = await fetch("/api/verified-match/attempt", {
            signal: controller.signal,
            cache: "no-store",
          }),
          data = await r.json();
        if (
          !r.ok ||
          !Array.isArray(data.attempts) ||
          data.attempts.length > 20 ||
          !data.attempts.every(
            (a: Attempt) =>
              typeof a.attemptId === "string" &&
              getGameDefinition(a.gameId) &&
              a.match,
          )
        )
          throw new Error("INVALID_RESULTS");
        if (!controller.signal.aborted) {
          setAttempts(data.attempts);
          setFailed(false);
        }
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(refresh, 5000);
      }
    };
    void refresh();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, []);
  return (
    <section className={styles.panel} aria-label="Intentos guardados">
      <h2>Últimos intentos</h2>
      <small>ENTRENAMIENTO DE ESTE NAVEGADOR</small>
      {failed ? (
        <p role="status">Partidas no disponibles</p>
      ) : attempts === null ? (
        <p role="status">Cargando…</p>
      ) : attempts.length === 0 ? (
        <p>Sin partidas</p>
      ) : (
        <ul>
          {attempts.map((a) => (
            <li key={a.attemptId}>
              <span>
                <strong>{getGameDefinition(a.gameId)?.name}</strong>
                <small>{label(a)}</small>
              </span>
              <span>
                {a.height ?? a.score ?? "—"}
                {a.timeMs !== undefined && (
                  <small>
                    {(a.timeMs / 1000).toLocaleString("es-ES", {
                      minimumFractionDigits: 3,
                      maximumFractionDigits: 3,
                    })}{" "}
                    s
                  </small>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
