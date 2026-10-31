/**
 * Bowling V3 throw gesture (v125) — pure presentation-side mapping from the drawn stroke (screen px, ms) to the
 * quantised protocol-V2 values. Only the resulting ANGLE / SPIN / POWER actions are recorded and replayed.
 */
import { BOWLING_V2_ANGLE_CENTRE, BOWLING_V2_SPIN_CENTRE } from "./verified/bowlingProtocol.v2";

export type StrokePoint = { x: number; y: number; t: number };

/**
 * The throw stroke: from the lowest point of the gesture (where the upward stroke starts — a sideways aim drag before
 * it is not part of the throw) to the release point.
 */
export function strokeOf(g: { path: readonly StrokePoint[] }) {
  let k0 = 0;
  for (let i = 1; i < g.path.length - 1; i++) if (g.path[i].y >= g.path[k0].y) k0 = i;
  return g.path.slice(k0);
}
/**
 * Throw from the stroke. Direction: the straight line from its start to its end (49 steps, ±0.375 of sideways per
 * unit up fills the range). Spin: the largest sideways bend of the drawn line away from that straight line, relative
 * to its length (a line bowing left hooks right at the back end, like the end of the stroke; 17 steps). Power: the
 * final flick speed. Tiny wobbles are ignored; everything else counts, so the throw is sensitive.
 */
export function throwFromStroke(stroke: readonly StrokePoint[]) {
  if (stroke.length < 2) return null;
  const a = stroke[0], b = stroke[stroke.length - 1], dx = b.x - a.x, dy = b.y - a.y;
  if (dy > -30) return null;
  const tilt = dx / -dy, angle = Math.max(0, Math.min(48, Math.round(BOWLING_V2_ANGLE_CENTRE + (Math.abs(tilt) < 0.012 ? 0 : tilt) * 64)));
  const len = Math.hypot(dx, dy);
  let bend = 0;
  for (const p of stroke) {
    const k = (p.y - a.y) / dy, dev = (a.x + dx * k - p.x) * (-dy / len);
    if (Math.abs(dev) > Math.abs(bend * len)) bend = dev / len;
  }
  const spin = Math.max(0, Math.min(16, Math.round(BOWLING_V2_SPIN_CENTRE + (Math.abs(bend) < 0.02 ? 0 : bend) * 60)));
  return { angle, spin, power: swipePower(stroke) };
}

/** Throw speed measured over the last ~110 ms of the stroke (the flick), mapped onto POWER 0–8 on a gentle curve. */
export function swipePower(path: readonly StrokePoint[]) {
  const start = path[0], end = path[path.length - 1];
  let k = path.length - 1;
  while (k > 0 && end.t - path[k].t < 110) k--;
  const from = path[k], ms = Math.max(30, end.t - from.t), recent = (from.y - end.y) / ms;
  const overall = (start.y - end.y) / Math.max(60, end.t - start.t);
  const speed = Math.max(recent, overall);
  return Math.max(0, Math.min(8, Math.round((speed - 0.3) / 0.26)));
}
