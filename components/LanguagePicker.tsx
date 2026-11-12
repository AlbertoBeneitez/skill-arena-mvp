"use client";
import { LOCALES, localeInfo, useI18n } from "@/lib/i18n";

/** Decorative: the language name next to it carries the meaning. */
function Flag({ code }: { code: string }) {
  return <img className="langFlag" src={`/flags/${code}.svg`} alt="" width={24} height={18} decoding="async" draggable={false} />;
}

/** Native-name language list. `compact` renders a select (welcome screen). */
export default function LanguagePicker({ compact = false }: { compact?: boolean }) {
  const { t, locale, setLocale } = useI18n();
  if (compact) {
    return (
      <label className="languageSelect">
        <Flag code={localeInfo(locale).flag} />
        <span className="visuallyHidden">{t("welcome.language")}</span>
        <select value={locale} onChange={(event) => void setLocale(event.target.value as typeof locale)} aria-label={t("welcome.language")}>
          {LOCALES.map((item) => (
            <option key={item.code} value={item.code} lang={item.code}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <div className="languageList" role="radiogroup" aria-label={t("settings.sectionLanguage")}>
      {LOCALES.map((item) => (
        <button
          key={item.code}
          type="button"
          role="radio"
          aria-checked={locale === item.code}
          lang={item.code}
          dir={item.dir}
          onClick={() => void setLocale(item.code)}
        >
          <Flag code={item.flag} />
          <span>{item.name}</span>
          <small lang="en" dir="ltr">{item.english}</small>
          <b aria-hidden="true">{locale === item.code ? "✓" : ""}</b>
        </button>
      ))}
    </div>
  );
}
