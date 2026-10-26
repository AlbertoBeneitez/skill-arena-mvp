"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import GameActionButton from "./GameActionButton";
import { FOCUS_TRACKS, currentMusicTrack, type MusicChoice } from "@/lib/gameFeedback";
import { updateSettings, useSettings } from "@/lib/settings";
import { t, useI18n, type MessageKey } from "@/lib/i18n";

/** Order in the menu: the six focus songs first, then the mix and the game's own theme. */
const MENU_CHOICES: readonly MusicChoice[] = [...FOCUS_TRACKS, "mix", "game"];

type Props = {
  musicOn: boolean;
  onToggleSound(): void;
  /** "header" = catalogue bar, "game" = in-game bar (uses the touch-safe button). */
  variant: "header" | "game";
};

/**
 * The megaphone: a tap opens a small panel to switch sound on/off and pick one of the six songs
 * (or the mix / the game's theme). The choice is the same setting as in Ajustes → Tipo de música.
 */
export default function SoundMenu({ musicOn, onToggleSound, variant }: Props) {
  useI18n();
  const settings = useSettings();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const [, bump] = useState(0);
  const anchor = useRef<HTMLSpanElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const place = useCallback(() => {
    const r = anchor.current?.getBoundingClientRect();
    if (!r) return;
    const width = Math.min(272, window.innerWidth - 16);
    // Right-aligned under the megaphone, but never past either screen edge.
    const right = Math.max(8, Math.min(Math.round(window.innerWidth - r.right - 4), window.innerWidth - width - 8));
    setPos({ top: Math.round(r.bottom + 8), right });
  }, []);
  const toggleOpen = () => {
    if (!open) place();
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const tick = setInterval(() => bump((n) => n + 1), 1000); // "now playing" follows the mix
    window.addEventListener("keydown", key);
    window.addEventListener("resize", place);
    panel.current?.querySelector<HTMLButtonElement>("[aria-checked='true']")?.focus({ preventScroll: true });
    return () => { clearInterval(tick); window.removeEventListener("keydown", key); window.removeEventListener("resize", place); };
  }, [open, place]);

  const choose = (choice: MusicChoice) => {
    updateSettings({ musicTrack: choice, music: true });
    if (!musicOn) onToggleSound();
    bump((n) => n + 1);
  };

  const playing = musicOn && settings.music ? currentMusicTrack() : null;
  const label = t("sound.menuAria");
  const icon = musicOn ? "🔊" : "🔇";
  const trigger = variant === "game"
    ? <GameActionButton className={`gameSoundToggle ${musicOn ? "on" : "off"}`} aria-label={label} aria-haspopup="dialog" aria-expanded={open} onActivate={toggleOpen}>{icon}</GameActionButton>
    : <button className={`soundToggle ${musicOn ? "on" : "off"}`} type="button" aria-label={label} aria-haspopup="dialog" aria-expanded={open} onClick={toggleOpen}>{icon}</button>;

  return (
    <span className="soundMenuAnchor" ref={anchor}>
      {trigger}
      {open && pos && typeof document !== "undefined" && createPortal(
        <>
          <div className="soundMenuBackdrop" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="soundMenu" role="dialog" aria-label={label} ref={panel} style={{ top: pos.top, right: pos.right }}>
            <button type="button" role="switch" aria-checked={musicOn} className="soundMenuSwitch" aria-label={musicOn ? t("common.soundOff") : t("common.soundOn")} onClick={onToggleSound}>
              <span>{t("sound.toggle")}</span>
              <i aria-hidden="true" />
            </button>
            <p className="soundMenuTitle">{t("sound.menuTitle")}</p>
            <div role="radiogroup" aria-label={t("sound.menuTitle")} className="soundMenuList">
              {MENU_CHOICES.map((choice) => {
                const selected = settings.musicTrack === choice;
                const now = playing === choice;
                return (
                  <button key={choice} type="button" role="radio" aria-checked={selected} className={`soundMenuItem ${selected ? "selected" : ""} ${FOCUS_TRACKS.includes(choice as never) ? "song" : "extra"}`} onClick={() => choose(choice)}>
                    <span className="soundMenuNote" aria-hidden="true">{now ? <b className="soundMenuEq"><i /><i /><i /></b> : "♪"}</span>
                    <span>{t(`settings.track.${choice}` as MessageKey)}</span>
                    {now && <small>{t("sound.nowPlaying")}</small>}
                  </button>
                );
              })}
            </div>
          </div>
        </>,
        document.body,
      )}
    </span>
  );
}
