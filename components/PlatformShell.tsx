"use client";
/**
 * v179 · Replaces the phone-only gate. Phones and tablets get the app directly (mobile platform). A computer gets the
 * same app inside a phone-sized frame on this origin, marked as the desktop platform, so it looks and behaves the same
 * but competes only against computers (lib/platform.ts). Inside that frame the app renders normally.
 */
import { useEffect, useState, type ReactNode } from "react";
import qrcode from "qrcode-generator";
import { t, useI18n } from "@/lib/i18n";
import { PLATFORM_PARAM, isFramed, isPhoneLikeDevice } from "@/lib/platform";
import { installMouseDragScroll } from "./mouseDragScroll";

function QrCode({ text }: { text: string }) {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount(), cells: string[] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) cells.push(`M${c},${r}h1v1h-1z`);
  return (
    <svg className="deskQr" viewBox={`-2 -2 ${n + 4} ${n + 4}`} role="img" aria-label={t("desktop.qrAria")}>
      <rect x={-2} y={-2} width={n + 4} height={n + 4} fill="#fff" rx={1.5} />
      <path d={cells.join("")} fill="#0d0e0f" />
    </svg>
  );
}

export default function PlatformShell({ children }: { children: ReactNode }) {
  useI18n();
  const [frameSrc, setFrameSrc] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  // v182: inside the desktop frame the mouse drags horizontal strips, like a swipe on a phone.
  useEffect(() => (isFramed() ? installMouseDragScroll() : undefined), []);
  useEffect(() => {
    if (isFramed()) return;
    const coarse = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
    if (isPhoneLikeDevice(navigator, coarse)) return;
    const url = new URL(window.location.href);
    url.searchParams.set(PLATFORM_PARAM, "desktop");
    setFrameSrc(url.pathname + url.search + url.hash);
    setOrigin(window.location.origin + "/");
  }, []);
  if (!frameSrc) return <>{children}</>;
  return (
    <main className="deskStage">
      <aside className="deskSide">
        <p className="deskBrand">GALACTIC GAMES</p>
        <p className="deskPlatform">{t("desktop.platform")}</p>
        <p className="deskNote">{t("desktop.note")}</p>
        {origin && (
          <div className="deskPhone">
            <QrCode text={origin} />
            <span>{t("desktop.phone")}</span>
          </div>
        )}
      </aside>
      <iframe className="deskFrame" src={frameSrc} title="GALACTIC GAMES" allow="fullscreen; autoplay; clipboard-write; web-share" />
    </main>
  );
}
