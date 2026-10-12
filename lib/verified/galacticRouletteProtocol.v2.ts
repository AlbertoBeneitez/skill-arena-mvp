/** Cartesian hand toss: quantized table-plane direction and impulse, never a result. */
import { ROULETTE_BETS as OLD_BETS } from "./galacticRouletteProtocol.v1";
export const ROULETTE_BETS_V2 = [
  ...OLD_BETS,
  "COLUMN_1",
  "COLUMN_2",
  "COLUMN_3",
] as const;
export const rouletteTossAction = (direction: number, impulse: number) =>
  `TOSS_D${String(direction).padStart(2, "0")}_P${String(impulse).padStart(2, "0")}`;
export const ROULETTE_ACTIONS_V2 = [
  ...ROULETTE_BETS_V2.map((b) => `BET_${b}`),
  ...Array.from(
    { length: 40 },
    (_, i) => `RELEASE_X_${String(i).padStart(2, "0")}`,
  ),
  ...Array.from(
    { length: 41 },
    (_, i) => `RELEASE_Y_${String(i).padStart(2, "0")}`,
  ),
  ...Array.from({ length: 32 }, (_, d) =>
    Array.from({ length: 16 }, (_, p) => rouletteTossAction(d, p)),
  ).flat(),
] as const;
