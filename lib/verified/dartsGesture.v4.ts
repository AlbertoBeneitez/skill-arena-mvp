/**
 * Client input translation only (V4 gesture, v120). The server still validates and replays AIM_X / AIM_Y / THROW.
 *
 * Same throw as V3 — grab anywhere, flick up, release — with more weight on the player's movement:
 *  - Horizontal (unchanged): release point plus the flick's sideways direction.
 *  - Vertical: the flick speed AND how far up the finger travels before letting go. A softer flick or an earlier
 *    (lower) release drops the dart; a harder flick or a later (higher) release lifts it. V3 used the speed alone, so
 *    the lower half of the board needed an unnaturally slow flick (the bottom double was out of reach).
 * Speed and direction come from the last ~100 ms of the swipe (the actual flick), not the slow wind-up.
 */
export type DartsGestureSample = { x: number; y: number; t: number };
export const DARTS_GESTURE_V4 = Object.freeze({
  idealSpeed: 1.4, // px/ms upward at release that lands on the bull's line (with the neutral release height)
  speedToPx: 120, // board px of vertical miss per px/ms away from the ideal
  releaseRefY: 350, // screen y of a neutral release
  releaseYToPx: 0.45, // board px lower per screen px the release is below the neutral line
  directionToPx: 240, // board px of sideways landing per unit of dx/dy in the flick
  releaseToPx: 0.3, // board px per screen px of release offset from the centre
  minUp: 40, // px of upward travel required for a throw
  minSpeed: 0.3, // px/ms upward at release required for a throw
  window: 100, // ms of the flick measured
  centreX: 195,
});

/** Returns null (no throw: the dart goes back to the hand) or the aim units 0..60 for X and Y. */
export function dartsFlickAimV4(path: readonly DartsGestureSample[]) {
  const G = DARTS_GESTURE_V4;
  if (path.length < 2) return null;
  const first = path[0], end = path[path.length - 1];
  if (first.y - end.y < G.minUp) return null;
  let k = path.length - 1;
  while (k > 0 && end.t - path[k].t < G.window) k--;
  const from = path[k], ms = Math.max(16, end.t - from.t);
  const vy = (from.y - end.y) / ms, vx = (end.x - from.x) / ms;
  if (vy < G.minSpeed) return null;
  const offX = (end.x - G.centreX) * G.releaseToPx + (vx / vy) * G.directionToPx;
  const offY = (G.idealSpeed - vy) * G.speedToPx + (end.y - G.releaseRefY) * G.releaseYToPx;
  const unit = (v: number) => Math.max(0, Math.min(60, Math.round(v / 5) + 30));
  return { x: unit(offX), y: unit(offY), speed: vy };
}
