"use client";
import RankingAvatar from "./RankingAvatar";
import ProfitChart, { profitSeries } from "./ProfitChart";
import { PRODUCT_NAME } from "@/lib/productIdentity";
import { localeInfo, useI18n } from "@/lib/i18n";
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
  const { t, locale } = useI18n();
  const [source, setSource] = useState<"server" | "demo">("server");
  const [cursor, setCursor] = useState<string | null>(null);
  const [history, setHistory] = useState<(string | null)[]>([]);
  const [state, setState] = useState<LoadState>({
    key: "server:",
    status: "loading",
  });
  const [retry, setRetry] = useState(0);
  const [openRow, setOpenRow] = useState<string | null>(null);
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
    <section className={`globalRankingScreen${embedded ? " embeddedRanking" : ""}`} aria-label={t("ranking.title")}>
      <header className="rankingHeading">
        {!embedded && <small>{PRODUCT_NAME}</small>}
        {embedded ? <h2>{t("ranking.title")}</h2> : <h1>{t("ranking.title")}</h1>}
      </header>
      <div className="rankingSourceControls" aria-label={t("ranking.source")}>
        <button
          type="button"
          aria-pressed={source === "server"}
          onClick={() => switchSource("server")}
        >
          {t("ranking.real")}
        </button>
        <button
          type="button"
          aria-pressed={source === "demo"}
          onClick={() => switchSource("demo")}
        >
          {t("ranking.example")}
        </button>
      </div>
      {source === "demo" && (
        <div className="rankingDemoNotice" role="note">
          <strong>{t("ranking.exampleNotice")}</strong>
        </div>
      )}
      {visible.status === "loading" && <p role="status">{t("ranking.loading")}</p>}
      {visible.status === "not-configured" && (
        <div className="rankingEmpty" role="status">
          <h2>{t("ranking.notConfigured")}</h2>
        </div>
      )}
      {visible.status === "unavailable" && (
        <div className="rankingEmpty" role="status">
          <h2>{t("ranking.unavailable")}</h2>
          <button type="button" onClick={() => setRetry((n) => n + 1)}>
            {t("common.retry")}
          </button>
        </div>
      )}
      {visible.status === "error" && (
        <div className="rankingEmpty" role="alert">
          <p>{t("ranking.pageError")}</p>
          <button
            type="button"
            onClick={() => {
              setCursor(null);
              setHistory([]);
              setRetry((n) => n + 1);
            }}
          >
            {t("common.reload")}
          </button>
        </div>
      )}
      {visible.status === "ready" && page && (
        <>
          {!cursor && page.entries.length > 0 && (
            <section className="rankingLeaders" aria-label={t("ranking.topPlayersAria")}>
              <h2>{source === "demo" ? t("ranking.topExample") : t("ranking.top")}</h2>
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
                    <ProfitChart
                      values={profitSeries(row.playerId, row.netProfitMinor)}
                      label={t("ranking.evolutionOf", { name: row.playerName })}
                    />
                  </article>
                ))}
              </div>
            </section>
          )}
          {page.entries.length === 0 ? (
            <p role="status">{t("ranking.empty")}</p>
          ) : (
            <div className="rankingTableWrap">
              <table className="rankingTable">
                <caption>
                  {source === "demo"
                    ? t("ranking.captionExample")
                    : t("ranking.captionReal")}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">{t("ranking.position")}</th>
                    <th scope="col">{t("ranking.player")}</th>
                    <th scope="col">{t("ranking.netProfit")}</th>
                    <th scope="col">{t("ranking.evolution")}</th>
                  </tr>
                </thead>
                <tbody>
                  {page.entries.map((row) => {
                    const values = profitSeries(row.playerId, row.netProfitMinor),
                      open = openRow === row.playerId;
                    return [
                      <tr
                        key={row.playerId}
                        className="rankingRowToggle"
                        tabIndex={0}
                        aria-expanded={open}
                        onClick={() => setOpenRow(open ? null : row.playerId)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setOpenRow(open ? null : row.playerId);
                          }
                        }}
                      >
                        <td>#{row.position}</td>
                        <td>
                          <span className="rankingPlayer">
                            <RankingAvatar name={row.playerName} avatarKey={row.avatarKey} />
                            <span title={row.playerName}>{row.playerName}</span>
                          </span>
                        </td>
                        <td className={row.netProfitMinor.startsWith("-") ? "rankingNegative" : "rankingPositive"}>
                          {formatNetProfit(row.netProfitMinor)}
                        </td>
                        <td className="rankingSpark">
                          <ProfitChart values={values} width={96} height={30} label={t("ranking.evolutionOf", { name: row.playerName })} />
                        </td>
                      </tr>,
                      open ? (
                        <tr key={`${row.playerId}-chart`} className="rankingChartRow">
                          <td colSpan={4}>
                            <strong>{t("ranking.howEarned", { name: row.playerName })}</strong>
                            <ProfitChart values={values} width={320} height={130} detailed label={t("ranking.detailOf", { name: row.playerName })} />
                            <small>{t("ranking.fictitiousRange", { amount: formatNetProfit(row.netProfitMinor) })}</small>
                          </td>
                        </tr>
                      ) : null,
                    ];
                  })}
                </tbody>
              </table>
            </div>
          )}
          <nav className="rankingPagination" aria-label={t("ranking.pages")}>
            <button
              type="button"
              disabled={!history.length}
              onClick={() => {
                setCursor(history.at(-1) ?? null);
                setHistory((items) => items.slice(0, -1));
              }}
            >
              {t("common.previous")}
            </button>
            <span>{t("common.page", { n: history.length + 1 })}</span>
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
              {t("common.next")}
            </button>
          </nav>
          {source === "server" && page.asOf && (
            <p className="rankingTimestamp">
              {t("ranking.updated", { date: new Date(page.asOf).toLocaleString(localeInfo(locale).intl, { timeZone: "Europe/Madrid" }) })}
            </p>
          )}
        </>
      )}
      <section className="rankingOwnPosition" aria-label={t("ranking.yourPosition")}>
        <h2>{t("ranking.yourPosition")}</h2>
        <p>{t("ranking.yourPositionNote")}</p>
      </section>
    </section>
  );
}
