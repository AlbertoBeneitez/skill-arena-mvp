import { useSyncExternalStore } from "react";
import es, { type MessageKey } from "./messages/es";
import { DEFAULT_LOCALE, isLocaleCode, localeInfo, matchLocale, type LocaleCode } from "./locales";

export { LOCALES, localeInfo, type LocaleCode } from "./locales";
export type { MessageKey } from "./messages/es";
export type Messages = Record<MessageKey, string>;
export type Vars = Record<string, string | number>;

/** Kept outside the "skill-arena-" prefix, so the per-visit reset never wipes the language. */
export const LOCALE_STORAGE_KEY = "ga-locale";

const loaded: Partial<Record<LocaleCode, Messages>> = { es };
const loaders: Record<Exclude<LocaleCode, "es">, () => Promise<{ default: Messages }>> = {
  en: () => import("./messages/en"),
  zh: () => import("./messages/zh"),
  hi: () => import("./messages/hi"),
  ar: () => import("./messages/ar"),
  fr: () => import("./messages/fr"),
  bn: () => import("./messages/bn"),
  pt: () => import("./messages/pt"),
  ru: () => import("./messages/ru"),
  ur: () => import("./messages/ur"),
};

let current: LocaleCode = DEFAULT_LOCALE;
let version = 0;
const listeners = new Set<() => void>();

function emit() {
  version++;
  for (const listener of listeners) listener();
}

/** Translate a key. Works anywhere (React, canvas renderers, plain functions). */
export function t(key: MessageKey, vars?: Vars): string {
  const text = loaded[current]?.[key] ?? es[key] ?? key;
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

/** Translate a key that is only known at runtime (e.g. a game id); falls back to `fallback`. */
export function tDynamic(key: string, fallback: string, vars?: Vars): string {
  return key in es ? t(key as MessageKey, vars) : fallback;
}

export function getLocale(): LocaleCode {
  return current;
}

function applyDocument(code: LocaleCode) {
  if (typeof document === "undefined") return;
  const info = localeInfo(code);
  document.documentElement.lang = code;
  document.documentElement.dir = info.dir;
}

export async function setLocale(code: LocaleCode, persist = true) {
  if (!isLocaleCode(code)) return;
  if (!loaded[code] && code !== "es") {
    try {
      loaded[code] = (await loaders[code]()).default;
    } catch {
      return;
    }
  }
  current = code;
  applyDocument(code);
  if (persist) {
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, code);
    } catch {
      /* storage may be blocked: the choice lasts for this visit */
    }
  }
  emit();
}

let initialised = false;
/** Called once after hydration: saved choice, else the browser language, else Spanish. */
export function initLocale() {
  if (initialised || typeof window === "undefined") return;
  initialised = true;
  let saved: string | null = null;
  try {
    saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    saved = null;
  }
  const code = isLocaleCode(saved) ? saved : matchLocale(navigator.languages ?? [navigator.language]);
  if (code === DEFAULT_LOCALE) applyDocument(code);
  else void setLocale(code, isLocaleCode(saved));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const formatters = new Map<string, Intl.NumberFormat>();
function numberFormat(options: Intl.NumberFormatOptions = {}) {
  const key = `${current}|${JSON.stringify(options)}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(`${localeInfo(current).intl}-u-nu-latn`, options);
    formatters.set(key, formatter);
  }
  return formatter;
}

/** Locale-aware number with Latin digits. */
export function formatNumber(value: number, options?: Intl.NumberFormatOptions) {
  return numberFormat(options).format(value);
}

/** Fictitious balance shown in euros, formatted for the active language. */
export function formatMoney(value: number) {
  return numberFormat({ style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

/** React binding: re-renders the caller when the language changes. */
export function useI18n() {
  const locale = useSyncExternalStore(subscribe, () => current, () => DEFAULT_LOCALE);
  useSyncExternalStore(subscribe, () => version, () => 0);
  return { locale, t, setLocale, formatNumber, formatMoney, dir: localeInfo(locale).dir };
}
