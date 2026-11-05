"use client";
/**
 * v147 · A published studio game, for everyone, in training: the package is downloaded, checked against the SHA-256
 * the catalogue lists, and run in the isolated frame; at the end the result is the core's replay of the match, shown
 * with whether the interface agreed. Nothing here touches the balance, the ranking or any record.
 */
import { useEffect, useState } from "react";
import UiIcon from "./UiIcon";
import { t, formatNumber, useI18n } from "@/lib/i18n";
import { publishedPackageUrl, type PublishedGame } from "@/lib/studio/published";
import StudioGameFrame, { freshSeed, useStudioPackage, type StudioOutcome } from "./StudioGameFrame";

export default function ExternalGamePlayer({ game, onClose }: { game: PublishedGame; onClose: () => void }) {
  useI18n();
  const { pkg, error } = useStudioPackage(publishedPackageUrl(game), game.sha256);
  const [seed, setSeed] = useState(() => freshSeed("train"));
  const [outcome, setOutcome] = useState<StudioOutcome | null>(null);
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  const match = !!outcome && outcome.ui === outcome.core;
  return (
    <div className="extGame" role="dialog" aria-modal="true" aria-labelledby="ext-game-title">
      <header className="extGameHead">
        <button type="button" className="gxIconBtn extGameBack" onClick={onClose} aria-label={t("studio.ext.back")}><UiIcon name="back" size={20} /></button>
        <div className="extGameTitle">
          <h2 id="ext-game-title">{game.game}</h2>
          <span>{t("game.training")} · {t("studio.ext.by", { studio: game.studio })}</span>
        </div>
        <span className="extGameBadge">{t("studio.ext.badge")}</span>
      </header>
      <div className="extGameStage">
        {error ? <p className="extGameStatus" role="alert">{t(error === "integrity" ? "studio.ext.integrity" : "studio.ext.failed")}</p>
          : pkg ? <StudioGameFrame pkg={pkg} seed={seed} title={game.game} onResult={setOutcome} />
          : <p className="extGameStatus" role="status">{t("studio.ext.loading")}</p>}
        {outcome && (
          <div className="extGameResult" role="status" aria-live="polite" data-state={match ? "ok" : "fail"}>
            <strong>{t("studio.ext.score", { n: formatNumber(outcome.core) })}</strong>
            <p>{t(match ? "studio.ext.verified" : "studio.ext.mismatch")}</p>
            <small>{t("studio.ext.scope")}</small>
            <div className="extGameActions">
              <button type="button" className="mainAction" onClick={() => { setOutcome(null); setSeed(freshSeed("train")); }}>{t("studio.ext.again")}</button>
              <button type="button" className="extGameLeave" onClick={onClose}>{t("studio.ext.back")}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
