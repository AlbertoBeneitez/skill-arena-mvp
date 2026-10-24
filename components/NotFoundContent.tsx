"use client";
import Link from "next/link";
import { useEffect } from "react";
import { initLocale, useI18n } from "@/lib/i18n";

export default function NotFoundContent() {
  const { t } = useI18n();
  useEffect(() => initLocale(), []);
  return (
    <main className="sitePage" aria-labelledby="nf-title">
      <p className="sitePageKicker">GALACTIC GAMES</p>
      <h1 id="nf-title">{t("notFound.title")}</h1>
      <p>{t("notFound.body")}</p>
      <Link className="sitePageAction" href="/">
        {t("error.home")}
      </Link>
    </main>
  );
}
