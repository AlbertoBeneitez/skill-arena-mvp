import { billiardsDirection } from "./verified/billiardsCore.v1";
import { billiardsAimAction } from "./verified/billiardsProtocol.v1";
import { billiardsPowerActionV3 } from "./verified/billiardsCore.v3";
type Point = Readonly<{x: number; y: number}>;
export type CueDrag = Readonly<{from: Point; cue: Point; shaft: boolean; initialDistance: number}>;
export function grabBilliardsCue(point: Point, cue: Point, aim: number): CueDrag | null {
  const dx = point.x - cue.x, dy = point.y - cue.y;
  const d = billiardsDirection(aim), along = -(dx * d.x + dy * d.y) / d.length;
  const lateral = Math.abs(dx * d.y - dy * d.x) / d.length;
  const nearBall = Math.hypot(dx, dy) <= 30;
  if (!nearBall && !(along >= 12 && along <= 150 && lateral <= 24)) return null;
  return {from: point, cue, shaft: !nearBall, initialDistance: Math.hypot(dx, dy)};
}
export function pullBilliardsCue(drag: CueDrag, point: Point) {
  if (![point.x, point.y].every(Number.isFinite)) return null;
  const dx = drag.shaft ? drag.cue.x - point.x : drag.from.x - point.x;
  const dy = drag.shaft ? drag.cue.y - point.y : drag.from.y - point.y;
  const distance = Math.hypot(dx, dy);
  const pull = drag.shaft ? distance - drag.initialDistance : distance;
  if (pull < 14) return null;
  const angle = (Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2);
  const aim = Math.round(angle * 180 / (Math.PI * 2)) % 180;
  const power = Math.max(0, Math.min(12, Math.round((pull - 14) / 8)));
  return [billiardsAimAction(aim), billiardsPowerActionV3(power)] as const;
}
