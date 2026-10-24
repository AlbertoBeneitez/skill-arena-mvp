import { tDynamic } from "./index";

type GameLike = { id: string; name: string; tagline?: string; skillLabel?: string; category?: string };

/** Localised catalogue text for a game; falls back to the registry text. */
export const gameName = (game: GameLike) => tDynamic(`gameMeta.${game.id}.name`, game.name);
export const gameTagline = (game: GameLike) => tDynamic(`gameMeta.${game.id}.tagline`, game.tagline ?? "");
export const gameSkill = (game: GameLike) => tDynamic(`gameMeta.${game.id}.skill`, game.skillLabel ?? "");
export const gameCategory = (game: GameLike) => tDynamic(`cat.${game.category ?? ""}`, game.category ?? "");
