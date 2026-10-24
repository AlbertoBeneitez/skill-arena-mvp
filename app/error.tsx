"use client";
import { useEffect } from "react";
import { initLocale, useI18n } from "@/lib/i18n";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();
  useEffect(() => initLocale(), []);
  return (
    <main className="sitePage" role="alert" aria-labelledby="err-title">
      <p className="sitePageKicker">GALACTIC GAMES</p>
      <h1 id="err-title">{t("error.title")}</h1>
      <p>{t("error.body")}</p>
      {error.digest ? <p className="sitePageCode">{t("error.code", { code: error.digest })}</p> : null}
      <button type="button" className="sitePageAction" onClick={reset}>
        {t("error.retry")}
      </button>
      <a className="sitePageLink" href="/">
        {t("error.home")}
      </a>
    </main>
  );
}
