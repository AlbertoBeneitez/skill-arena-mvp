/** Test-only encounter steering emits the same legal held inputs as touch controls. */
import { hopEnemyX, type SkyHopV3State } from "../lib/verified/skyHopCore.v3";

export function hopDirectionAction(
  state: SkyHopV3State,
  direction: -1 | 0 | 1,
): string | null {
  if (state.left && direction !== -1) return "LEFT_UP";
  if (state.right && direction !== 1) return "RIGHT_UP";
  if (direction < 0 && !state.left) return "LEFT_DOWN";
  if (direction > 0 && !state.right) return "RIGHT_DOWN";
  return null;
}
export function chooseHopEncounterAction(
  state: SkyHopV3State,
  index: number,
): string | null {
  const target = hopEnemyX(state, state.enemies[index], state.tick + 8);
  const error = target - state.x - state.vx * 7;
  return hopDirectionAction(state, error > 4000 ? 1 : error < -4000 ? -1 : 0);
}
