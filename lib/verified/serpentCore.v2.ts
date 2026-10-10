/** A small cadence reduction over the immutable toroidal V1 kernel. */
import { SERPENT_CORE, SERPENT_V1, type SerpentState } from "./serpentCore.v1";
import type { GameCore } from "./coreRuntime.v1";
export const SERPENT_V2 = {
  initialStepTicks: 18,
  minimumStepTicks: 10,
} as const;
export type SerpentV2State = SerpentState & { height: number };
export function serpentStepPeriodV2(foods: number) {
  return Math.max(
    SERPENT_V2.minimumStepTicks,
    SERPENT_V2.initialStepTicks -
      Math.floor(foods / SERPENT_V1.foodsPerAcceleration),
  );
}
export const SERPENT_CORE_V2: GameCore<SerpentV2State> = {
  ...SERPENT_CORE,
  gameVersion: "2.0.0",
  content: {
    base: SERPENT_CORE.content,
    cadence: SERPENT_V2,
    reach: "consumed-generated-foods",
  },
  create: (seed) => ({
    ...SERPENT_CORE.create(seed),
    stepTicks: SERPENT_V2.initialStepTicks,
    height: 0,
  }),
  step: (state) => {
    SERPENT_CORE.step(state);
    state.stepTicks = serpentStepPeriodV2(state.foods);
    state.height = state.foods;
  },
};
