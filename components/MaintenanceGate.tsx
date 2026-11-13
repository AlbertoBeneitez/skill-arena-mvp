"use client";
/**
 * v186 · Maintenance notice. Asks /api/health once when the app opens and again when the tab comes back; if the
 * server answers 503 (its database does not respond) every screen is covered by a notice that rechecks each minute
 * and disappears by itself once the service is back. Offline or network errors show nothing: that is the player's
 * connection, not maintenance. Healthy apps are not polled, so the free database is not kept awake.
 * Planned maintenance uses a switch in Vercel › Firewall instead (docs/MANUAL_OPERACION.md), which sends players to
 * /mantenimiento.html without touching the app.
 */
import { useCallback, useEffect, useState } from "react";
import { t, useI18n } from "@/lib/i18n";
import st from "./MaintenanceGate.module.css";

async function serviceDown() {
  try {
    const res = await fetch("/api/health", { cache: "no-store" });
    // Only the status matters; release the body so the request finishes.
    await res.body?.cancel().catch(() => undefined);
    return res.status === 503;
  } catch {
    return false;
  }
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
