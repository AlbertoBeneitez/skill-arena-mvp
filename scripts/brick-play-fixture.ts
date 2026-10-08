import { integerSqrt, clamp, roundDiv } from "../lib/deterministic/integerMath";
import {
  relayBounce,
  relayBrickX,
  type BrickState,
} from "../lib/verified/brickRelayCore.v1";
/** Test-only geometric player; layouts, ball and paddle are public information. */
function reflected(x: number) {
  const w = 374000,
    p = (((x - 8000) % (w * 2)) + w * 2) % (w * 2);
  return 8000 + (p <= w ? p : w * 2 - p);
}
export function chooseBrickAction(s: BrickState) {
  let aim = s.ballX;
  if (s.vy > 0 && s.ballY > 320000) {
    const down = Math.max(0, Math.ceil((562000 - s.ballY) / s.vy)),
      landing = reflected(s.ballX + s.vx * down),
      live = s.bricks.filter((b) => b.hp > 0),
      bottom = Math.max(...live.map((b) => b.y + b.h));
    let best = Infinity;
    for (let n = 0; n < 79; n++) {
      const centre = clamp(n * 5000, s.paddleW / 2, 390000 - s.paddleW / 2);
      if (Math.abs(landing - centre) > s.paddleW / 2 + 5000) continue;
      const v = relayBounce(landing, centre, s.paddleW, s.speed),
        up = Math.ceil((562000 - bottom - 8000) / -v.vy),
        px = reflected(landing + v.vx * up);
      const targets = live.filter((b) => b.y + b.h === bottom),
        cost = Math.min(
          ...targets.map(
            (b) =>
              Math.abs(px - relayBrickX(b, s.tick + down + up) - b.w / 2) -
              (b.kind === "blast" ? 1000 : 0),
          ),
        );
      if (cost < best) {
        best = cost;
        aim = centre;
      }
    }
  }
  const action = `AIM_${String(clamp(Math.round(aim / 5000), 0, 78)).padStart(3, "0")}`;
  return action;
}
