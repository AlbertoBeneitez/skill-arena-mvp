/**
 * Pictures of groups. v218 (owner: "mucho más peliculero"): film-still scenes rendered from code by
 * scripts/render-group-art.py (original artwork, public/groups/*.webp). v220: five more, and any of the eleven can be
 * chosen as the group's picture (offline, and online by the group's owner, kept as `art`). A group without a chosen
 * picture or photo always shows the same one of the first six, picked from its id or code.
 */
export const GROUP_ART_IDS = [
  "crew", "eclipse", "stargate", "launch", "moonbase", "comets",
  "blackhole", "aurora", "miners", "supernova", "derelict",
] as const;
export type GroupArtId = (typeof GROUP_ART_IDS)[number];
/** The default pool: the six pictures before v220, so existing groups keep their picture. */
const DEFAULT_POOL = GROUP_ART_IDS.slice(0, 6);
export const groupArtSrc = (id: GroupArtId) => `/groups/${id}.webp`;
export const GROUP_ARTS = GROUP_ART_IDS.map(groupArtSrc);
export const isGroupArtId = (value: unknown): value is GroupArtId => typeof value === "string" && (GROUP_ART_IDS as readonly string[]).includes(value);
/** The art id behind one of these pictures' paths, or null (a photo, or another image). */
export function groupArtIdOf(src: string | undefined | null): GroupArtId | null {
  const m = /^\/groups\/([a-z]+)\.webp$/.exec(src ?? "");
  return m && isGroupArtId(m[1]) ? m[1] : null;
}

export function groupArt(key: string): string {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return groupArtSrc(DEFAULT_POOL[(h >>> 0) % DEFAULT_POOL.length]);
}
