"use client";
import { t } from "@/lib/i18n";

/** Last-resort boundary: renders its own document, so it cannot rely on app CSS. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#081522",
          color: "#f0f7ff",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: 24,
        }}
      >
        <main role="alert">
          <h1 style={{ fontSize: 24 }}>{t("error.title")}</h1>
          <p style={{ color: "#bfd5e5" }}>{t("error.body")}</p>
          <button
            type="button"
            onClick={reset}
            style={{ minHeight: 48, padding: "0 24px", borderRadius: 14, border: 0, background: "#a0ebe1", color: "#0d2933", fontWeight: 700, fontSize: 16 }}
          >
            {t("error.retry")}
          </button>
        </main>
      </body>
    </html>
  );
}
