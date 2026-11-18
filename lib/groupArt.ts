/**
 * Default pictures of groups. v218 (owner: "mucho más peliculero"): six film-still scenes rendered from code by
 * scripts/render-group-art.py (original artwork, public/groups/*.webp): astronauts planting a flag before a ringed
 * giant, an eclipse with its corona, a ring gate opening, a night launch, a moon base under Earthrise and three
 * comets past a dark world. Before v218 they were small SVG drawings. A group without its own photo always shows
 * the same one, picked from its id or code.
 */
export const GROUP_ARTS = [
  "/groups/crew.webp",
  "/groups/eclipse.webp",
  "/groups/stargate.webp",
  "/groups/launch.webp",
  "/groups/moonbase.webp",
  "/groups/comets.webp",
] as const;
export function groupArt(key: string): string {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return GROUP_ARTS[(h >>> 0) % GROUP_ARTS.length];
}
