/**
 * v191 · Rules for a player's public identity, shared by the browser (instant feedback) and the server (authority).
 * Pure TypeScript.
 */
export const NAME_PATTERN = /^[\p{L}\p{M}\p{N}_ ]{2,18}$/u;
export const RESERVED_NAMES = ["admin", "administrador", "skillarena", "skill_arena", "galactic", "galacticgames", "galactic games", "soporte", "support", "moderador", "moderator", "staff", "sistema", "system"];
export const AVATAR_MAX = 64;
/** Fictitious welcome balance of a new account, in minor units (25 ₡). */
export const WELCOME_MINOR = 2500;

export const foldName = (value: string) => value.trim().normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ");

export function cleanName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.normalize("NFC").trim().replace(/\s+/g, " ");
  if (!NAME_PATTERN.test(name)) return null;
  const folded = foldName(name);
  if (RESERVED_NAMES.some((r) => folded === r || folded.replace(/[ _]/g, "") === r.replace(/[ _]/g, ""))) return null;
  return name;
}

export const validAvatar = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 1 && (value as number) <= AVATAR_MAX;
