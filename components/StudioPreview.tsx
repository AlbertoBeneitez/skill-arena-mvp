"use client";
/**
 * Owner review of a submitted game (v142): one match in the isolated frame, then the core's replay of the inputs is
 * compared with the score the interface reports — the same verification a published match goes through.
 */
import { useState } from "react";
import { t, useI18n } from "@/lib/i18n";
import StudioGameFrame, { freshSeed, useStudioPackage, type StudioOutcome } from "./StudioGameFrame";

export default function StudioPreview({ id, game, onClose }: { id: string; game: string; onClose: () => void }) {
  useI18n();
  const { pkg, error } = useStudioPackage(`/api/studio/proposals?id=${id}`);
  const [seed, setSeed] = useState(() => freshSeed("review"));
  const [outcome, setOutcome] = useState<StudioOutcome | null>(null);
  const [inputs, setInputs] = useState(0);
  const again = () => { setOutcome(null); setInputs(0); setSeed(freshSeed("review")); };
  const match = outcome && outcome.ui === outcome.core;
  return (
    <div className="studioPreview" role="dialog" aria-modal="true" aria-label={t("studio.previewTitle", { game })}>
      <header className="studioHead">
        <h2>{t("studio.previewTitle", { game })}</h2>
        <button type="button" className="studioClose" onClick={onClose} aria-label={t("studio.close")}>✕</button>
      </header>
      <div className="studioFrame">
        {error ? <p className="studioStatus">{t("studio.failed")}</p>
          : pkg ? <StudioGameFrame pkg={pkg} seed={seed} title={game} onInputs={setInputs} onResult={setOutcome} />
          : <p className="studioStatus">{t("studio.checking")}</p>}
      </div>
      <p className="studioVerdict" role="status" aria-live="polite" data-state={outcome ? (match ? "ok" : "fail") : "wait"}>
        {outcome ? t(match ? "studio.previewMatch" : "studio.previewMismatch", { ui: outcome.ui, core: outcome.core, n: outcome.inputs })
          : t("studio.previewPlay", { n: inputs })}
      </p>
      <button type="button" className="studioReplay" onClick={again}>{t("studio.previewAgain")}</button>
    </div>
  );
}
