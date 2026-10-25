/**
 * Client input translation only (V3 gesture). The server still validates and replays AIM_X / AIM_Y / THROW.
 *
 * The finger throws the dart: where the flick goes and how fast it is decide where the dart lands.
 *  - Horizontal: the release point plus the flick's direction (sideways drift per pixel travelled upward).
 *  - Vertical: the flick speed. A flick at IDEAL px/ms lands on the bull's line; slower drops low, faster flies high.
 * Speed and direction come from the last ~100 ms of the swipe (the actual flick), not the slow wind-up.
 */
export type DartsGestureSample = { x: number; y: number; t: number };
export const DARTS_GESTURE_V3 = Object.freeze({
  idealSpeed: 1.5, // px/ms upward at release that lands on the bull's line
  speedToPx: 95, // board px of vertical miss per px/ms away from the ideal
  directionToPx: 240, // board px of sideways landing per unit of dx/dy in the flick
  releaseToPx: 0.3, // board px per screen px of release offset from the centre
  minUp: 40, // px of upward travel required for a throw
  minSpeed: 0.35, // px/ms upward at release required for a throw
  window: 100, // ms of the flick measured
  centreX: 195,
});

/** Returns null (no throw: the dart goes back to the hand) or the aim units 0..60 for X and Y. */
export function dartsFlickAimV3(path: readonly DartsGestureSample[]) {
  const G = DARTS_GESTURE_V3;
  if (path.length < 2) return null;
  const first = path[0], end = path[path.length - 1];
  if (first.y - end.y < G.minUp) return null;
  let k = path.length - 1;
  while (k > 0 && end.t - path[k].t < G.window) k--;
  const from = path[k], ms = Math.max(16, end.t - from.t);
  const vy = (from.y - end.y) / ms, vx = (end.x - from.x) / ms;
  if (vy < G.minSpeed) return null;
  const offX = (end.x - G.centreX) * G.releaseToPx + (vx / vy) * G.directionToPx;
  const offY = (G.idealSpeed - vy) * G.speedToPx;
  const unit = (v: number) => Math.max(0, Math.min(60, Math.round(v / 5) + 30));
  return { x: unit(offX), y: unit(offY), speed: vy };
}
