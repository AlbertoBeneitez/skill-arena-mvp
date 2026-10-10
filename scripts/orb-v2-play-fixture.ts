/** Test-only choices use visible cells and the official fixed-point forecast, never future supply colors. */
import {
  forecastOrbV2,
  orbNeighborsV2,
  type OrbV2State,
} from "../lib/verified/orbBurstCore.v2";
export function bestOrbAimV2(state: OrbV2State): number {
  let best = state.aimIndex,
    bestValue = -Infinity;
  for (let aim = 0; aim < 89; aim++) {
    const future = forecastOrbV2(state, aim).state,
      landing = future.lastLanding;
    const neighbors = landing
      ? orbNeighborsV2(state, landing.row, landing.col).filter((n) =>
          state.bubbles.some(
            (b) =>
              b.row === n.row &&
              b.col === n.col &&
              b.color === state.currentColor,
          ),
        ).length
      : 0;
    const value =
      (future.height - state.height) * 100000 +
      neighbors * 1000 -
      (landing?.row ?? 0) * 10;
    if (future.status !== "failed" && value > bestValue) {
      bestValue = value;
      best = aim;
    }
  }
  return best;
}
export function worstOrbAimV2(state: OrbV2State): number {
  let worst = state.aimIndex,
    worstValue = Infinity;
  for (let aim = 0; aim < 89; aim++) {
    const future = forecastOrbV2(state, aim).state;
    const value =
      (future.height - state.height) * 100000 -
      (future.lastLanding?.row ?? 0) * 1000 -
      future.pressureRows;
    if (value < worstValue) {
      worstValue = value;
      worst = aim;
    }
  }
  return worst;
}
