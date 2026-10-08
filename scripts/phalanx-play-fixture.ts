import {
  PHALANX_CORE as core,
  type PhalanxState,
} from "../lib/verified/starPhalanxCore.v1";
import { clamp } from "../lib/deterministic/integerMath";
const targets = new WeakMap<PhalanxState, number>();
/** Test player tracks one visible opponent and keeps a safe lane until a bolt passes. */
export function choosePhalanxAction(s: PhalanxState): string | null {
  if (!s.firing) return "FIRE_DOWN";
  let desired = s.targetX;
  if (s.nextLayerTick === null) {
    const enemies = s.enemies.filter((e) => e.hp > 0);
    let target = enemies.find((e) => e.id === targets.get(s));
    if (!target)
      target = enemies.reduce<(typeof enemies)[number] | undefined>(
        (best, e) =>
          !best ||
          Math.abs(e.x + s.offset - s.shipX) <
            Math.abs(best.x + s.offset - s.shipX)
            ? e
            : best,
        undefined,
      );
    if (target) {
      targets.set(s, target.id);
      const flight = Math.floor((532000 - target.y - s.descent) / 4000),
        speed = Math.floor((16000 + s.wave * 6500) / 120);
      desired = clamp(
        target.x + s.offset + s.direction * speed * flight,
        20000,
        370000,
      );
    }
  }
  for (const b of s.shots.filter(
    (b) => b.enemy && !b.spent && b.y > 400000 && b.y < 575000,
  )) {
    const cross =
      (s.shipX <= b.x && desired >= b.x) || (s.shipX >= b.x && desired <= b.x);
    if (
      cross ||
      Math.abs(desired - b.x) < 45000 ||
      Math.abs(s.shipX - b.x) < 35000
    ) {
      const left = b.x - 55000,
        right = b.x + 55000;
      desired =
        s.shipX < b.x && left >= 20000
          ? Math.min(desired, left)
          : right <= 370000
            ? Math.max(desired, right)
            : Math.min(desired, left);
    }
  }
  desired = clamp(desired, 20000, 370000);
  const action = `AIM_${String(Math.max(0, Math.min(35, Math.round((desired - 20000) / 10000)))).padStart(3, "0")}`;
  return core.canApply(s, action) ? action : null;
}
