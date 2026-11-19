"use client";
/**
 * v219 · The game finder of the Groups tab — category chips, a search box and the games' covers — shared by the
 * competition form (several games in order, or a random slot) and the online challenge to another group (one game).
 * Presentation only: the caller keeps the picked list.
 */
import { useState } from "react";
import { RANDOM_GAME } from "@/lib/groupCompetition";
import { CATALOG_SHELVES, gameShelf, type GameMeta } from "@/lib/games";
import { t, useI18n } from "@/lib/i18n";
import { gameName } from "@/lib/i18n/games";
import UiIcon from "@/components/UiIcon";
import st from "./GroupHub.module.css";

const fold = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

type Props = {
  games: readonly GameMeta[];
  picked: readonly string[];
  /** Several games, numbered in the order picked (repeats allowed); otherwise one. */
  multi: boolean;
  /** Offer the «random» tile first (multi only). */
  withRandom?: boolean;
  onTap(id: string): void;
  onUnpick?(id: string): void;
  label: string;
};

export default function GamePicker({ games, picked, multi, withRandom = false, onTap, onUnpick, label }: Props) {
  useI18n();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const tiles = [
    ...(withRandom ? [{ id: RANDOM_GAME, name: t("group.randomMix"), cover: "" }] : []),
    ...games.filter((g) => !category || gameShelf(g) === category).map((g) => ({ id: g.id, name: gameName(g), cover: g.cover })),
  ].filter((tile) => !query.trim() || fold(tile.name).includes(fold(query.trim())));
  return (
    <>
      <div className={st.categories} role="group" aria-label={t("group.categories")}>
        {["", ...CATALOG_SHELVES].map((key) => (
          <button key={key || "all"} type="button" aria-pressed={category === key} onClick={() => setCategory(key)}>
            {key ? t(`catalog.shelf.${key}` as "catalog.shelf.bar") : t("group.categoryAll")}
          </button>
        ))}
      </div>
      <label className={st.search}>
        <UiIcon name="search" size={18} />
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("group.searchGames")} aria-label={t("group.searchGames")} enterKeyHint="search" />
      </label>
      <div className={st.games} role="group" aria-label={label}>
        {tiles.map(({ id, name, cover }) => {
          const numbers = picked.flatMap((x, i) => (x === id ? [i + 1] : []));
          const mark = numbers.length > 3 ? `${numbers.slice(0, 2).join(" ")} +${numbers.length - 2}` : numbers.join(" ");
          return (
            <div key={id} className={st.tileWrap}>
              <button type="button" className={st.gameTile} aria-pressed={numbers.length > 0} onClick={() => onTap(id)}
                aria-label={numbers.length && multi ? `${name} · ${numbers.join(", ")}` : name}>
                {cover ? <span className={st.gameArt}><img src={cover} alt="" loading="lazy" decoding="async" /></span>
                  : <span className={st.gameArt} data-random><UiIcon name="dice" size={26} /></span>}
                <span className={st.gameMark} data-wide={numbers.length > 1 || undefined} aria-hidden="true">{!numbers.length ? null : multi ? mark : <UiIcon name="check" size={12} />}</span>
                <span className={st.gameName}>{name}</span>
              </button>
              {multi && onUnpick && numbers.length > 0 && (
                <span className={st.unpickLayer}>
                  <button type="button" className={st.unpick} onClick={() => onUnpick(id)}
                    aria-label={t("group.removeFromSequence", { game: name, n: numbers[numbers.length - 1] })}><UiIcon name="close" size={10} /></button>
                </span>
              )}
            </div>
          );
        })}
      </div>
      {!tiles.length && <p className={st.hint}>{t("group.noGamesFound")}</p>}
    </>
  );
}
