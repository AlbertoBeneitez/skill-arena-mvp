/** Test-only steering reads the deterministic scene; never part of game rules. */
import { hopPlatformX, type SkyHopState } from "../lib/verified/skyHopCore.v1";
export function chooseHopAction(s: SkyHopState): string | null {
  const index = Math.min(75, s.lastLandingIndex + 1),
    p = s.platforms[index];
  let y = s.y,
    vy = s.vy,
    landing = 1;
  for (let t = 1; t < 200; t++) {
    vy += 73;
    y += vy;
    if (vy > 0 && y + 19000 >= p.y) {
      landing = t;
      break;
    }
  }
  const target = hopPlatformX(p, s.tick + landing) + p.width / 2;
  const error = target - (s.x + s.vx * 7);
  const direction = error > 14000 ? 1 : error < -14000 ? -1 : 0;
  if (s.left && direction !== -1) return "LEFT_UP";
  if (s.right && direction !== 1) return "RIGHT_UP";
  if (direction === -1 && !s.left) return "LEFT_DOWN";
  if (direction === 1 && !s.right) return "RIGHT_DOWN";
  return null;
}
