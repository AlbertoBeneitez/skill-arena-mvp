/** Test player seeks nearby openings and deliberately clears jumpable barriers. */
import {
  METRO_LANES,
  metroSpeed,
  type MetroState,
} from "../lib/verified/metroShiftCore.v1";
export function chooseMetroAction(s: MetroState): string | null {
  const g = s.groups.find((g) => !g.passed);
  if (!g) return null;
  const d = g.z - s.distance;
  if (d > 320000) return null;
  const hazard = g.hazards.find((h) => h.lane === s.lane);
  if (hazard?.kind === "barrier") {
    if (d <= metroSpeed(s) * 42 && d > 25000 && s.jumpY === 0) return "JUMP";
    return null;
  }
  if (hazard?.kind === "wall" || g.pickupLane !== null) {
    const safe = METRO_LANES.map((_, lane) => lane).filter(
      (l) => !g.hazards.some((h) => h.lane === l),
    );
    const target =
      g.pickupLane ??
      safe.sort((a, b) => Math.abs(a - s.lane) - Math.abs(b - s.lane))[0];
    if (target !== s.lane) return target < s.lane ? "LEFT" : "RIGHT";
  }
  return null;
}
