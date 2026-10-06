import { hashSeed } from "./seeded";

/**
 * Curated competitive challenge sets.
 *
 * Solitaire:
 * - Each deck was solver-validated offline under the exact Skill Arena rules:
 *   draw-one stock, unlimited redeals, tableau moves, waste/tableau to
 *   foundation, no foundation-to-tableau undo.
 * - We deliberately keep only deals that required substantial tableau work
 *   and repeated stock traversal in the validator.
 *
 * Mine Grid:
 * - Each board was validated offline by a standard local-deduction solver.
 * - From the fixed shared opening, every board can be completed without a
 *   guess. The chosen boards require several deduction rounds and a larger
 *   frontier than the old generated boards.
 */

export type SolitaireChallenge = {
  id: string;
  deck: readonly number[];
  verifiedMoves: number;
  tableauMoves: number;
  stockDraws: number;
  redeals: number;
};

export const SOLITAIRE_CHALLENGES: readonly SolitaireChallenge[] = [
  {
    id: "S-02",
    deck: [15,29,9,21,4,6,51,26,22,24,8,34,36,18,40,30,45,7,20,31,49,44,46,12,41,14,11,0,39,1,33,17,35,28,48,32,25,27,47,37,2,43,13,38,16,19,42,10,23,50,5,3],
    verifiedMoves: 268,
    tableauMoves: 42,
    stockDraws: 154,
    redeals: 11,
  },
  {
    id: "S-03",
    deck: [13,28,3,19,29,26,51,22,36,10,32,6,11,17,33,48,24,31,1,18,5,2,21,44,47,43,41,27,42,20,7,9,25,49,39,12,14,35,16,45,0,46,4,50,40,30,38,23,8,34,37,15],
    verifiedMoves: 153,
    tableauMoves: 17,
    stockDraws: 76,
    redeals: 3,
  },
  {
    id: "S-04",
    deck: [37,22,39,21,16,51,28,50,42,43,7,13,36,38,40,12,10,2,32,27,45,44,29,24,48,41,20,26,0,31,8,49,11,17,23,34,33,14,3,18,35,47,1,4,5,9,30,25,46,6,19,15],
    verifiedMoves: 147,
    tableauMoves: 18,
    stockDraws: 70,
    redeals: 4,
  },
  {
    id: "S-08",
    deck: [4,21,50,11,28,51,18,17,44,26,10,38,6,33,9,20,30,19,27,3,41,35,40,16,43,22,0,34,7,42,46,39,47,36,49,37,31,29,1,25,13,32,15,48,5,2,45,12,8,24,23,14],
    verifiedMoves: 266,
    tableauMoves: 42,
    stockDraws: 150,
    redeals: 10,
  },
  {
    id: "S-12",
    deck: [20,3,8,26,11,34,4,5,19,13,46,37,15,25,40,7,32,27,36,44,12,41,21,16,2,39,18,1,6,48,31,10,47,28,45,43,35,14,38,29,50,51,23,0,24,9,22,49,33,42,17,30],
    verifiedMoves: 191,
    tableauMoves: 19,
    stockDraws: 106,
    redeals: 5,
  },
];

export type MineChallenge = {
  id: string;
  cols: number;
  rows: number;
  startIndex: number;
  mineIndexes: readonly number[];
  deductionRounds: number;
  maxFrontier: number;
};

export const MINE_CHALLENGES: readonly MineChallenge[] = [
  { id:"M-03", cols:10, rows:14, startIndex:74, mineIndexes:[3,7,10,16,33,34,38,40,49,59,60,66,68,77,94,99,101,109,113,120,121,133,138,139], deductionRounds:9, maxFrontier:30 },
  { id:"M-04", cols:10, rows:14, startIndex:74, mineIndexes:[5,6,15,17,23,26,27,39,44,49,54,56,60,66,67,69,70,77,92,101,102,122,133,137], deductionRounds:10, maxFrontier:27 },
  { id:"M-06", cols:10, rows:14, startIndex:74, mineIndexes:[0,5,9,20,22,23,24,37,49,50,66,67,69,81,92,95,104,105,108,120,124,125,137,138], deductionRounds:13, maxFrontier:29 },
  { id:"M-11", cols:10, rows:14, startIndex:74, mineIndexes:[3,7,9,10,15,16,23,24,36,40,47,48,61,77,101,114,115,118,119,121,130,131,135,137], deductionRounds:10, maxFrontier:31 },
  { id:"M-35", cols:10, rows:14, startIndex:74, mineIndexes:[2,5,6,13,15,18,20,24,33,39,40,42,60,70,87,92,93,95,110,122,126,127,131,134], deductionRounds:15, maxFrontier:32 },
  { id:"M-53", cols:10, rows:14, startIndex:74, mineIndexes:[7,9,12,14,32,33,35,43,50,55,58,66,81,88,89,92,103,112,116,123,128,129,130,133], deductionRounds:10, maxFrontier:30 },
  { id:"M-57", cols:10, rows:14, startIndex:74, mineIndexes:[4,5,10,27,35,36,39,42,45,57,82,94,95,96,97,101,109,111,122,124,130,131,132,139], deductionRounds:8, maxFrontier:28 },
  { id:"M-62", cols:10, rows:14, startIndex:74, mineIndexes:[1,4,7,16,20,31,41,43,44,47,54,60,66,78,79,87,91,101,114,118,120,130,132,139], deductionRounds:13, maxFrontier:32 },
];

export function solitaireChallengeFor(seed: string) {
  return SOLITAIRE_CHALLENGES[
    hashSeed(seed) % SOLITAIRE_CHALLENGES.length
  ];
}

export function mineChallengeFor(seed: string) {
  return MINE_CHALLENGES[
    hashSeed(seed) % MINE_CHALLENGES.length
  ];
}
