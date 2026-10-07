import {
  forecastOrb,
  orbNeighbors,
  type OrbState,
} from "../lib/verified/orbBurstCore.v1";
export function bestOrbAim(state: OrbState) {
  let best = state.aimIndex,
    score = -Infinity;
  for (let i = 0; i < 89; i++) {
    const forecast = forecastOrb(state, i).state;
    const landing = forecast.lastLanding;
    const matchingNeighbors = landing
      ? orbNeighbors(landing.row, landing.col).filter((n) =>
          state.bubbles.some(
            (b) =>
              b.row === n.row &&
              b.col === n.col &&
              b.color === state.currentColor,
          ),
        ).length
      : 0;
    const value =
      (forecast.score - state.score) * 1000 +
      matchingNeighbors * 10 -
      forecast.bubbles.length -
      (landing?.row ?? 0) * 0.1;
    if (forecast.status === "running" && value > score) {
      score = value;
      best = i;
    }
  }
  return best;
}
