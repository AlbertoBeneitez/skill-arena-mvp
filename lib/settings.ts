import { useSyncExternalStore } from "react";
import { MUSIC_CHOICES, setGameMusicEnabled, setGameMusicTrack, setHapticsEnabled, type MusicChoice } from "./gameFeedback";

/** Device preferences. Stored outside the "skill-arena-" prefix so the per-visit reset keeps them. */
export type AppSettings = {
  music: boolean;
  /** Which music plays: mix (default), the game's own theme, or one of the six focus tracks. */
  musicTrack: MusicChoice;
  vibration: boolean;
  reduceMotion: boolean;
  /** 0 = off. */
  reminderMinutes: 0 | 15 | 30 | 60;
};
export const SETTINGS_STORAGE_KEY = "ga-settings";
export const REMINDER_OPTIONS = [0, 15, 30, 60] as const;
const DEFAULTS: AppSettings = { music: true, musicTrack: "mix", vibration: true, reduceMotion: false, reminderMinutes: 0 };

let current: AppSettings = DEFAULTS;
const listeners = new Set<() => void>();

function apply(settings: AppSettings) {
  setGameMusicEnabled(settings.music);
  setGameMusicTrack(settings.musicTrack);
  setHapticsEnabled(settings.vibration);
  if (typeof document !== "undefined") {
    if (settings.reduceMotion) document.documentElement.dataset.reduceMotion = "1";
    else delete document.documentElement.dataset.reduceMotion;
  }
}

function parse(raw: string | null): AppSettings {
  try {
    const data = raw ? (JSON.parse(raw) as Partial<AppSettings>) : {};
    return {
      music: typeof data.music === "boolean" ? data.music : DEFAULTS.music,
      musicTrack: MUSIC_CHOICES.includes(data.musicTrack as MusicChoice) ? (data.musicTrack as MusicChoice) : DEFAULTS.musicTrack,
      vibration: typeof data.vibration === "boolean" ? data.vibration : DEFAULTS.vibration,
      reduceMotion: typeof data.reduceMotion === "boolean" ? data.reduceMotion : DEFAULTS.reduceMotion,
      reminderMinutes: (REMINDER_OPTIONS as readonly number[]).includes(data.reminderMinutes as number)
        ? (data.reminderMinutes as AppSettings["reminderMinutes"])
        : DEFAULTS.reminderMinutes,
    };
  } catch {
    return DEFAULTS;
  }
}

let initialised = false;
/** Called once after hydration. */
export function initSettings() {
  if (initialised || typeof window === "undefined") return;
  initialised = true;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
  } catch {
    raw = null;
  }
  current = parse(raw);
  apply(current);
  for (const listener of listeners) listener();
}

export function updateSettings(patch: Partial<AppSettings>) {
  current = { ...current, ...patch };
  apply(current);
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* storage may be blocked */
  }
  for (const listener of listeners) listener();
}

/** Back to defaults (used by "delete all my local data"). */
export function resetSettings() {
  current = DEFAULTS;
  apply(current);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSettings() {
  return useSyncExternalStore(subscribe, () => current, () => DEFAULTS);
}
