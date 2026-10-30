"use client";
import { t, useI18n } from "@/lib/i18n";

/**
 * v124 · Loading screen while a game's code arrives: the GALACTIC GAMES emblem (the rendered Saturn with a comet on
 * its orbit), the wordmark and an indeterminate progress line. Also used by games that need a moment to prepare.
 */
export default function GameLoading() {
  useI18n();
  return (
    <div className="gameLoading gxBoot" role="status" aria-live="polite">
      <div className="gxBootEmblem" aria-hidden="true">
        <span className="gxBootOrbit"><i /></span>
        <img src="/art/saturn-hero.webp?v=123" alt="" width={210} height={151} decoding="async" />
        <span className="gxBootOrbit front"><i /></span>
      </div>
      <div className="gxBootMark" aria-hidden="true"><b>GALACTIC</b><span>GAMES</span></div>
      <span className="gxBootBar" aria-hidden="true"><i /></span>
      <span className="gxBootText">{t("game.loading")}</span>
    </div>
  );
}

export { GameLoading };
