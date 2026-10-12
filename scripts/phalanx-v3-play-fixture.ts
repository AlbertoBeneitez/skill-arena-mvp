import {
  PHALANX_CORE as core,
  type PhalanxState,
} from "../lib/verified/starPhalanxCore.v3";
import { clamp } from "../lib/deterministic/integerMath";
const targets = new WeakMap<PhalanxState, number>();
/** Test player uses visible shots/charge/targets/rewards, not future seeded events. */
export function choosePhalanxAction(
  s: PhalanxState,
  shoot = true,
): string | null {
  if (shoot && !s.firing) return "FIRE_DOWN";
  if (s.tick % 6 !== 0) return null;
  const living = s.enemies.filter((e) => e.hp > 0);
  let target =
    living.find((e) => e.id === s.chargeId) ??
    living.find((e) => e.id === targets.get(s));
  target ??= living.reduce<(typeof living)[number] | undefined>(
    (best, e) =>
      !best ||
      Math.abs(e.x + s.offset - s.shipX) < Math.abs(best.x + s.offset - s.shipX)
        ? e
        : best,
    undefined,
  );
  let desired = s.targetX;
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
  const health = s.rewards
    .filter((r) => r.kind === "shield" && r.y > 350000)
    .sort((a, b) => b.y - a.y)[0];
  const coin = s.rewards.find(
    (r) =>
      r.kind === "points" && r.y > 490000 && Math.abs(r.x - s.shipX) < 45000,
  );
  if (s.lives < 3 && health) desired = health.x;
  else if (coin) desired = coin.x;
  let best = s.targetX,
    bestCost = Infinity;
  for (let n = 0; n < 36; n++) {
    const x = 20000 + n * 10000;
    let cost = Math.abs(x - desired) + Math.abs(x - s.shipX) * 0.15;
    for (const b of s.shots) {
      if (!b.enemy || b.spent) continue;
      const eta = (552000 - b.y) / b.vy;
      if (eta < -10 || eta > 130) continue;
      for (let dt = -8; dt <= 8; dt += 2) {
        const t = Math.max(0, Math.floor(eta + dt));
        const player = s.shipX + clamp(x - s.shipX, -2500 * t, 2500 * t),
          bx = b.x + b.vx * t;
        if (
          Math.abs(b.y + b.vy * t - 552000) < 18000 &&
          Math.abs(player - bx) < 24000
        )
          cost += 1000000;
      }
    }
    if (s.chargeId !== null && Math.abs(x - s.chargeAimX) < 32000)
      cost += 60000;
    if (cost < bestCost) {
      bestCost = cost;
      best = x;
    }
  }
  const a = `AIM_${String(Math.round((best - 20000) / 10000)).padStart(3, "0")}`;
  return core.canApply(s, a) ? a : null;
}
