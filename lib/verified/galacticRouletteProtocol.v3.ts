/** V3 protocol: chips on the cloth (no columns), undo/clear, and a toss from the fixed launcher. */
import { ROULETTE_BETS } from "./galacticRouletteProtocol.v1";
import { rouletteTossAction } from "./galacticRouletteProtocol.v2";
export { ROULETTE_BETS, rouletteTossAction };
export const ROULETTE_ACTIONS_V3 = [
  ...ROULETTE_BETS.map((b) => `BET_${b}`),
  "BETS_UNDO",
  "BETS_CLEAR",
  ...Array.from({ length: 32 }, (_, d) =>
    Array.from({ length: 16 }, (_, p) => rouletteTossAction(d, p)),
  ).flat(),
] as const;
