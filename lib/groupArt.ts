/**
 * v206 · Default pictures of groups (original artwork, public/groups/*.svg): a crew of astronauts, a little solar
 * system, a constellation of six stars, a fleet of rockets, a moon base and three braided comets. A group without its
 * own photo always shows the same one, picked from its id or code.
 */
export const GROUP_ARTS = [
  "/groups/crew.svg",
  "/groups/system.svg",
  "/groups/constellation.svg",
  "/groups/fleet.svg",
  "/groups/moonbase.svg",
  "/groups/comets.svg",
] as const;

export function groupArt(key: string): string {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return GROUP_ARTS[(h >>> 0) % GROUP_ARTS.length];
}
