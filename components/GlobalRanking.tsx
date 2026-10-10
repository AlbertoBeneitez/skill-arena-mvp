"use client";
import RankingAvatar from "./RankingAvatar";
import { PRODUCT_NAME } from "@/lib/productIdentity";
import { useEffect, useState } from "react";
import {
  formatNetProfit,
  isRankingPage,
  RANKING_PAGE_LIMIT,
  type RankingPage,
} from "@/lib/ranking";

type LoadState = {
  key: string;
  status: "loading" | "ready" | "not-configured" | "unavailable" | "error";
  page?: RankingPage;
};
export default function GlobalRanking({ embedded = false }: { embedded?: boolean }) {
  const [source, setSource] = useState<"server" | "demo">("server");
  const [cursor, setCursor] = useState<string | null>(null);
  const [history, setHistory] = useState<(string | null)[]>([]);
  const [state, setState] = useState<LoadState>({
    key: "server:",
    status: "loading",
  });
  const [retry, setRetry] = useState(0);
  const key = `${source}:${cursor ?? ""}`;
  const visible =
    state.key === key ? state : { key, status: "loading" as const };
  useEffect(() => {
    const controller = new AbortController();
    setState({ key, status: "loading" });
    async function load() {
      try {
        let page: unknown;
        if (source === "demo") {
          const demo = await import("@/lib/demo/globalRanking");
          page = demo.readDemoRankingPage(RANKING_PAGE_LIMIT, cursor);
        } else {
          const params = new URLSearchParams({
            limit: String(RANKING_PAGE_LIMIT),
          });
          if (cursor) params.set("cursor", cursor);
          const response = await fetch(`/api/rankings/global?${params}`, {
            signal: controller.signal,
            cache: "no-store",
          });
          if (response.status === 503) {
            if (!controller.signal.aborted)
              setState({ key, status: "unavailable" });
            return;
          }
          if (!response.ok) throw new Error("RANKING_REQUEST_FAILED");
          page = await response.json();
          if (
            page &&
            typeof page === "object" &&
            (page as { source?: unknown; status?: unknown }).source ===
              "server" &&
            (page as { status?: unknown }).status === "not-configured"
          ) {
            if (!controller.signal.aborted)
              setState({ key, status: "not-configured" });
            return;
          }
        }
        if (!isRankingPage(page, source))
          throw new Error("INVALID_RANKING_RESPONSE");
        if (!controller.signal.aborted)
          setState({ key, status: "ready", page });
      } catch {
        if (!controller.signal.aborted) setState({ key, status: "error" });
      }
    }
    void load();
    return () => controller.abort();
  }, [source, cursor, key, retry]);
  function switchSource(next: typeof source) {
    setSource(next);
    setCursor(null);
    setHistory([]);
  }
  const page = visible.page;
  return (
    <section className={`globalRankingScreen${embedded ? " embeddedRanking" : ""}`} aria-label="Ranking global">
      <header className="rankingHeading">
        {!embedded && <small>{PRODUCT_NAME}</small>}
        {embedded ? <h2>Ranking global</h2> : <h1>Ranking global</h1>}
      </header>
      <div className="rankingSourceControls" aria-label="Origen del ranking">
        <button
          type="button"
          aria-pressed={source === "server"}
          onClick={() => switchSource("server")}
        >
          Ranking real
        </button>
        <button
          type="button"
          aria-pressed={source === "demo"}
          onClick={() => switchSource("demo")}
        >
          Ver ejemplo
        </button>
      </div>
      {source === "demo" && (
        <div className="rankingDemoNotice" role="note">
          <strong>DATOS DE EJEMPLO · IMPORTES FICTICIOS</strong>
        </div>
      )}
      {visible.status === "loading" && <p role="status">Cargando ranking…</p>}
      {visible.status === "not-configured" && (
        <div className="rankingEmpty" role="status">
          <h2>El ranking real aún no está disponible</h2>
        </div>
      )}
      {visible.status === "unavailable" && (
        <div className="rankingEmpty" role="status">
          <h2>No se puede cargar el ranking ahora</h2>
          <button type="button" onClick={() => setRetry((n) => n + 1)}>
            Reintentar
          </button>
        </div>
      )}
      {visible.status === "error" && (
        <div className="rankingEmpty" role="alert">
          <p>No se pudo cargar esta página.</p>
          <button
            type="button"
            onClick={() => {
              setCursor(null);
              setHistory([]);
              setRetry((n) => n + 1);
            }}
          >
            Volver a cargar
          </button>
        </div>
      )}
      {visible.status === "ready" && page && (
        <>
          {!cursor && page.entries.length > 0 && (
            <section className="rankingLeaders" aria-label="Top jugadores">
              <h2>Top jugadores{source === "demo" ? " · ejemplo" : ""}</h2>
              <div>
                {page.entries.slice(0, 3).map((row) => (
                  <article key={row.playerId}>
                    <span className="rankingLeaderPosition">
                      #{row.position}
                    </span>
                    <RankingAvatar
                      name={row.playerName}
                      avatarKey={row.avatarKey}
                    />
                    <strong title={row.playerName}>{row.playerName}</strong>
                    <span>{formatNetProfit(row.netProfitMinor)}</span>
                  </article>
                ))}
              </div>
            </section>
          )}
          {page.entries.length === 0 ? (
            <p role="status">Aún no hay jugadores en este ranking.</p>
          ) : (
            <div className="rankingTableWrap">
              <table className="rankingTable">
                <caption>
                  {source === "demo"
                    ? "Ranking de ejemplo · beneficio neto ficticio"
                    : "Ranking global · beneficio neto histórico"}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Posición</th>
                    <th scope="col">Jugador</th>
                    <th scope="col">Beneficio neto</th>
                  </tr>
                </thead>
                <tbody>
                  {page.entries.map((row) => (
                    <tr key={row.playerId}>
                      <td>#{row.position}</td>
                      <td>
                        <span className="rankingPlayer">
                          <RankingAvatar
                            name={row.playerName}
                            avatarKey={row.avatarKey}
                          />
                          <span title={row.playerName}>{row.playerName}</span>
                        </span>
                      </td>
                      <td
                        className={
                          row.netProfitMinor.startsWith("-")
                            ? "rankingNegative"
                            : "rankingPositive"
                        }
                      >
                        {formatNetProfit(row.netProfitMinor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <nav className="rankingPagination" aria-label="Páginas del ranking">
            <button
              type="button"
              disabled={!history.length}
              onClick={() => {
                setCursor(history.at(-1) ?? null);
                setHistory((items) => items.slice(0, -1));
              }}
            >
              Anterior
            </button>
            <span>Página {history.length + 1}</span>
            <button
              type="button"
              disabled={!page.nextCursor}
              onClick={() => {
                if (page.nextCursor) {
                  setHistory((items) => [...items, cursor]);
                  setCursor(page.nextCursor);
                }
              }}
            >
              Siguiente
            </button>
          </nav>
          {source === "server" && page.asOf && (
            <p className="rankingTimestamp">
              Actualizado:{" "}
              {new Date(page.asOf).toLocaleString("es-ES", {
                timeZone: "Europe/Madrid",
              })}
            </p>
          )}
        </>
      )}
      <section className="rankingOwnPosition" aria-label="Tu posición">
        <h2>Tu posición</h2>
        <p>Sesión local · sin posición real</p>
      </section>
    </section>
  );
}
