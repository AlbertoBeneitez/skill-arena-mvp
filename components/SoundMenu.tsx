"use client";
import GameActionButton from "./GameActionButton";
import UiIcon from "./UiIcon";
import { t, useI18n } from "@/lib/i18n";

type Props = {
  musicOn: boolean;
  onToggleSound(): void;
  /** "header" = catalogue bar, "game" = in-game bar (uses the touch-safe button). */
  variant: "header" | "game";
};

/**
 * The megaphone. v219 (owner): a tap switches sound on or off — no song picker any more (the type of music stays in
 * Ajustes → Tipo de música).
 */
export default function SoundMenu({ musicOn, onToggleSound, variant }: Props) {
  useI18n();
  const label = musicOn ? t("common.soundOff") : t("common.soundOn");
  const icon = <><UiIcon name={musicOn ? "sound" : "soundOff"} /><i className="gxLed" aria-hidden="true" /></>;
  return variant === "game"
    ? <GameActionButton className={`gameSoundToggle gxIconBtn ${musicOn ? "on" : "off"}`} aria-label={label} aria-pressed={musicOn} onActivate={onToggleSound}>{icon}</GameActionButton>
    : <button className={`soundToggle gxIconBtn gxHeadBtn ${musicOn ? "on" : "off"}`} type="button" aria-label={label} aria-pressed={musicOn} onClick={onToggleSound}>{icon}</button>;
}
