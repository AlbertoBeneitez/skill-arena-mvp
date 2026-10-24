"use client";
import { useI18n } from "@/lib/i18n";
import { DOC_ORDER, DOC_TITLES, type DocId } from "@/lib/i18n/docs";
import { REMINDER_OPTIONS, updateSettings, useSettings } from "@/lib/settings";
import { APP_VERSION } from "@/lib/productIdentity";
import LanguagePicker from "./LanguagePicker";

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange(next: boolean): void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} className="settingsRow settingsToggle" onClick={() => onChange(!checked)}>
      <span>
        <strong>{label}</strong>
        {hint && <small>{hint}</small>}
      </span>
      <i aria-hidden="true" />
    </button>
  );
}

export default function SettingsScreen({
  soundOn,
  onToggleSound,
  onEditProfile,
  onResetStats,
  onDeleteData,
  onLogout,
  onOpenDoc,
  onBack,
}: {
  soundOn: boolean;
  onToggleSound(): void;
  onEditProfile(): void;
  onResetStats(): void;
  onDeleteData(): void;
  onLogout(): void;
  onOpenDoc(doc: DocId): void;
  onBack(): void;
}) {
  const { t } = useI18n();
  const settings = useSettings();
  return (
    <section className="settingsScreen" aria-labelledby="settings-title">
      <header className="settingsHead">
        <button type="button" className="docSheetBack" onClick={onBack} aria-label={t("settings.back")}>
          <span aria-hidden="true">←</span>
        </button>
        <h1 id="settings-title">{t("settings.title")}</h1>
      </header>

      <section className="settingsGroup" aria-labelledby="set-lang">
        <h2 id="set-lang">{t("settings.sectionLanguage")}</h2>
        <p className="settingsHint">{t("settings.languageHint")}</p>
        <LanguagePicker />
      </section>

      <section className="settingsGroup" aria-labelledby="set-sound">
        <h2 id="set-sound">{t("settings.sectionSound")}</h2>
        <Toggle label={t("settings.sound")} checked={soundOn} onChange={() => onToggleSound()} />
        <Toggle label={t("settings.music")} checked={settings.music} onChange={(music) => updateSettings({ music })} />
        <Toggle label={t("settings.vibration")} hint={t("settings.vibrationHint")} checked={settings.vibration} onChange={(vibration) => updateSettings({ vibration })} />
      </section>

      <section className="settingsGroup" aria-labelledby="set-display">
        <h2 id="set-display">{t("settings.sectionDisplay")}</h2>
        <Toggle label={t("settings.reduceMotion")} hint={t("settings.reduceMotionHint")} checked={settings.reduceMotion} onChange={(reduceMotion) => updateSettings({ reduceMotion })} />
      </section>

      <section className="settingsGroup" aria-labelledby="set-responsible">
        <h2 id="set-responsible">{t("settings.sectionResponsible")}</h2>
        <div className="settingsRow settingsChoice">
          <span>
            <strong>{t("settings.reminder")}</strong>
            <small>{t("settings.reminderHint")}</small>
          </span>
          <div role="radiogroup" aria-label={t("settings.reminder")}>
            {REMINDER_OPTIONS.map((minutes) => (
              <button key={minutes} type="button" role="radio" aria-checked={settings.reminderMinutes === minutes} onClick={() => updateSettings({ reminderMinutes: minutes })}>
                {minutes === 0 ? t("settings.reminderOff") : t("settings.reminderMinutes", { n: minutes })}
              </button>
            ))}
          </div>
        </div>
        <button type="button" className="settingsRow settingsLink" onClick={() => onOpenDoc("responsible")}>
          <span><strong>{t("docs.responsible")}</strong></span>
          <b aria-hidden="true">›</b>
        </button>
      </section>

      <section className="settingsGroup" aria-labelledby="set-account">
        <h2 id="set-account">{t("settings.sectionAccount")}</h2>
        <button type="button" className="settingsRow settingsLink" onClick={onEditProfile}>
          <span><strong>{t("settings.editProfile")}</strong></span>
          <b aria-hidden="true">›</b>
        </button>
        <button type="button" className="settingsRow settingsLink" onClick={onResetStats}>
          <span><strong>{t("settings.resetStats")}</strong></span>
          <b aria-hidden="true">↺</b>
        </button>
        <button type="button" className="settingsRow settingsLink" onClick={onLogout}>
          <span><strong>{t("settings.logout")}</strong></span>
          <b aria-hidden="true">⎋</b>
        </button>
        <button type="button" className="settingsRow settingsLink danger" onClick={onDeleteData}>
          <span><strong>{t("settings.deleteData")}</strong></span>
          <b aria-hidden="true">✕</b>
        </button>
      </section>

      <section className="settingsGroup" aria-labelledby="set-info">
        <h2 id="set-info">{t("settings.sectionInfo")}</h2>
        {DOC_ORDER.filter((doc) => doc !== "responsible").map((doc) => (
          <button key={doc} type="button" className="settingsRow settingsLink" onClick={() => onOpenDoc(doc)}>
            <span><strong>{t(DOC_TITLES[doc])}</strong></span>
            <b aria-hidden="true">›</b>
          </button>
        ))}
      </section>

      <p className="settingsVersion">{t("settings.version", { version: `\u2068${APP_VERSION}\u2069` })}</p>
    </section>
  );
}
