"use client";
import { useEffect, useState, type ReactNode } from "react";
import qrcode from "qrcode-generator";
import { t, useI18n } from "@/lib/i18n";

/**
 * GALACTIC GAMES is a phone-only product. Phones and tablets (touch-first devices) get the app; anything whose
 * primary pointer is a mouse or trackpad gets a full-screen notice with a QR code to open the same address on a
 * phone. Client-side detection only: it cannot stop someone who deliberately spoofs a phone (user-agent override,
 * browser device emulation). Competitive integrity never depends on it (the server replays every match).
 */
export function isPhoneLikeDevice(nav: Pick<Navigator, "userAgent" | "maxTouchPoints">, coarsePointer: boolean) {
  const ua = nav.userAgent || "";
  if (/Android|iPhone|iPad|iPod|Mobile|Silk|Kindle|Opera Mini|IEMobile/i.test(ua)) return true;
  // iPadOS reports a desktop Safari user agent: recognise it by its touch screen and coarse primary pointer.
  return (nav.maxTouchPoints ?? 0) > 0 && coarsePointer;
}

function QrCode({ text }: { text: string }) {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount(), cells: string[] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) cells.push(`M${c},${r}h1v1h-1z`);
  return (
    <svg className="mobileGateQr" viewBox={`-2 -2 ${n + 4} ${n + 4}`} role="img" aria-label={t("mobileOnly.qrAria")}>
      <rect x={-2} y={-2} width={n + 4} height={n + 4} fill="#fff" rx={1.5} />
      <path d={cells.join("")} fill="#081522" />
    </svg>
  );
}

export default function MobileOnlyGate({ children }: { children: ReactNode }) {
  useI18n();
  const [blocked, setBlocked] = useState(false);
  const [url, setUrl] = useState("");
  useEffect(() => {
    const check = () => {
      const coarse = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
      setBlocked(!isPhoneLikeDevice(navigator, coarse));
      setUrl(window.location.origin + "/");
    };
    check();
    const media = typeof window.matchMedia === "function" ? window.matchMedia("(pointer: coarse)") : null;
    media?.addEventListener?.("change", check);
    return () => media?.removeEventListener?.("change", check);
  }, []);
  if (!blocked) return <>{children}</>;
  return (
    <main className="mobileGate" role="alert">
      <div className="mobileGateCard">
        <p className="mobileGateBrand">GALACTIC GAMES</p>
        <div className="mobileGatePhone" aria-hidden="true"><span /></div>
        <h1>{t("mobileOnly.title")}</h1>
        <p>{t("mobileOnly.body")}</p>
        {url && <QrCode text={url} />}
        {url && <p className="mobileGateUrl" dir="ltr">{url}</p>}
      </div>
    </main>
  );
}
