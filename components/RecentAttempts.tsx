"use client";
import { useEffect, useState } from "react";
import { getGameDefinition } from "@/lib/games";
import type { PublicMatchView } from "@/lib/publicMatch";
import styles from "./RecentAttempts.module.css";
import { formatNumber, t, useI18n } from "@/lib/i18n";
import { gameName } from "@/lib/i18n/games";
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
  if (row.state === "forfeited" || row.state === "rejected") return t("recent.lost");
  if (row.state === "playing") return t("recent.playing");
  if (row.state === "received") return t("recent.verifying");
  if (row.match.status === "waiting") return t("recent.waiting");
  if (row.match.winnerSlot === row.match.slot) return t("recent.won");
  return row.match.reason === "exact-tie" ? t("recent.tie") : t("recent.lost");
}
/** Own stored results only. Never updates the wallet or manufactures opponents. */
export default function RecentAttempts() {
  useI18n();
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
    <section className={styles.panel} aria-label={t("recent.aria")}>
      <h2>{t("recent.title")}</h2>
      <small>{t("recent.scope")}</small>
      {failed ? (
        <p role="status">{t("recent.unavailable")}</p>
      ) : attempts === null ? (
        <p role="status">{t("common.loading")}</p>
      ) : attempts.length === 0 ? (
        <p>{t("recent.empty")}</p>
      ) : (
        <ul>
          {attempts.map((a) => (
            <li key={a.attemptId}>
              <span>
                <strong>{(() => { const g = getGameDefinition(a.gameId); return g ? gameName(g) : a.gameId; })()}</strong>
                <small>{label(a)}</small>
              </span>
              <span>
                {a.height ?? a.score ?? "—"}
                {a.timeMs !== undefined && (
                  <small>
                    {t("common.seconds", { n: formatNumber(a.timeMs / 1000, { minimumFractionDigits: 3, maximumFractionDigits: 3 }) })}
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
