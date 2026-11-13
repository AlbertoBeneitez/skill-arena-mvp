"use client";
/**
 * v186 · Maintenance notice, automatic only (owner, 13-nov). Asks /api/health when the app opens and when the tab comes
 * back. The notice covers every screen when:
 *  - the server answers any 5xx (503: its database does not respond; 500/502/504: the server itself fails), or
 *  - the device says it is online but the server does not answer twice in a row, 5 s apart.
 * It rechecks every minute and disappears by itself once the service is back. A device without connection shows
 * nothing: that is the player's network, not maintenance. Healthy apps are not polled, so the free database sleeps.
 */
import { useCallback, useEffect, useState } from "react";
import { t, useI18n } from "@/lib/i18n";
import st from "./MaintenanceGate.module.css";

const RETRY_MS = 5000;

async function ask(): Promise<"ok" | "down" | "unreachable"> {
  try {
    const res = await fetch("/api/health", { cache: "no-store" });
    // Only the status matters; release the body so the request finishes.
    await res.body?.cancel().catch(() => undefined);
    return res.status >= 500 ? "down" : "ok";
  } catch {
    return "unreachable";
  }
}

async function serviceDown() {
  const first = await ask();
  if (first !== "unreachable") return first === "down";
  if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
  await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
  const second = await ask();
  return second === "down" || (second === "unreachable" && navigator.onLine !== false);
}

export default function MaintenanceGate() {
  useI18n();
  const [down, setDown] = useState(false);
  const check = useCallback(() => { void serviceDown().then(setDown); }, []);
  useEffect(() => {
    check();
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [check]);
  useEffect(() => {
    if (!down) return;
    const timer = window.setInterval(check, 60_000);
    return () => window.clearInterval(timer);
  }, [down, check]);
  if (!down) return null;
  return (
    <div className={st.gate} role="alertdialog" aria-modal="true" aria-labelledby="gg-maintenance-title" aria-describedby="gg-maintenance-body">
      <div className={st.card}>
        <span className={st.brand}>GALACTIC GAMES</span>
        <h2 id="gg-maintenance-title">{t("maintenance.title")}</h2>
        <p id="gg-maintenance-body">{t("maintenance.body")}</p>
        <button type="button" onClick={check}>{t("maintenance.retry")}</button>
      </div>
    </div>
  );
}
