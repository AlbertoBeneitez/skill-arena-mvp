"use client";
import { t, useI18n } from "@/lib/i18n";

/**
 * Loading screen while a game's code arrives (v132): the black stage and a thin progress line only, so no small
 * picture flashes between tapping a game and seeing it. The text is for screen readers.
 */
export default function GameLoading() {
  useI18n();
  return (
    <div className="gameLoading gxBoot" role="status" aria-live="polite">
      <span className="gxBootBar" aria-hidden="true"><i /></span>
      <span className="visuallyHidden">{t("game.loading")}</span>
    </div>
  );
}

export { GameLoading };
