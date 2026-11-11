"use client";
/**
 * «Enviar juego» welcome (v163; own component since v174): a short screen — earn money with your game — whose button
 * opens the submission page (where each real step carries its «i»). The three earlier style layers of globals.css
 * are consolidated in StudioWelcome.module.css with their final values.
 */
import UiIcon from "@/components/UiIcon";
import { t, useI18n } from "@/lib/i18n";
import st from "./StudioWelcome.module.css";

export default function StudioWelcome({ onClose, onSend }: { onClose: () => void; onSend: () => void }) {
  useI18n();
  return (
    <div className={st.scrim} role="dialog" aria-modal="true" aria-labelledby="studio-welcome-title" onClick={onClose}
      onKeyDown={(event) => { if (event.key === "Escape") onClose(); }}>
      <div className={st.card} onClick={(e) => e.stopPropagation()}>
        <button type="button" className={st.close} aria-label={t("common.close")} onClick={onClose}><UiIcon name="close" size={18} /></button>
        <span className={st.coin} aria-hidden="true"><UiIcon name="coins" size={52} /></span>
        <h2 id="studio-welcome-title">{t("studio.introTitle")}</h2>
        <p>{t("studio.introLine")}</p>
        <button type="button" className={st.go} autoFocus onClick={onSend}>{t("studio.goSend")}</button>
      </div>
    </div>
  );
}
