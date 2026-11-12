/**
 * The ten most widely spoken languages (Ethnologue, total speakers) plus the
 * product's original Spanish. `intl` drives number/date formatting; Latin
 * digits are kept everywhere so scores read the same inside the games.
 * `flag` names a file in public/flags/, matching the `intl` region.
 */
export const LOCALES = [
  { code: "es", name: "Español", english: "Spanish", intl: "es-ES", dir: "ltr", flag: "es" },
  { code: "en", name: "English", english: "English", intl: "en-US", dir: "ltr", flag: "us" },
  { code: "zh", name: "中文（简体）", english: "Chinese (Simplified)", intl: "zh-CN", dir: "ltr", flag: "cn" },
  { code: "hi", name: "हिन्दी", english: "Hindi", intl: "hi-IN", dir: "ltr", flag: "in" },
  { code: "ar", name: "العربية", english: "Arabic", intl: "ar", dir: "rtl", flag: "sa" },
  { code: "fr", name: "Français", english: "French", intl: "fr-FR", dir: "ltr", flag: "fr" },
  { code: "bn", name: "বাংলা", english: "Bengali", intl: "bn-BD", dir: "ltr", flag: "bd" },
  { code: "pt", name: "Português", english: "Portuguese", intl: "pt-BR", dir: "ltr", flag: "br" },
  { code: "ru", name: "Русский", english: "Russian", intl: "ru-RU", dir: "ltr", flag: "ru" },
  { code: "ur", name: "اردو", english: "Urdu", intl: "ur-PK", dir: "rtl", flag: "pk" },
] as const;

export type LocaleCode = (typeof LOCALES)[number]["code"];
export type LocaleInfo = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: LocaleCode = "es";

export function localeInfo(code: LocaleCode): LocaleInfo {
  return LOCALES.find((locale) => locale.code === code) ?? LOCALES[0];
}

export function isLocaleCode(value: unknown): value is LocaleCode {
  return typeof value === "string" && LOCALES.some((locale) => locale.code === value);
}

/** Best match for the browser's preferred languages ("pt-BR" → "pt"). */
export function matchLocale(preferred: readonly string[]): LocaleCode {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split(/[-_]/)[0];
    if (isLocaleCode(base)) return base;
  }
  return DEFAULT_LOCALE;
}
