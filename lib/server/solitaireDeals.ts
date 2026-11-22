/**
 * Solitaire Sprint V1 · private match issuer. A random Klondike deal is winnable only about two times in three, and
 * "the fastest solve wins" makes an unwinnable deal a match nobody can win. So the issuer draws private manifests until
 * the solver proves the deal winnable, once, when the match is created; replays never run the solver again.
 */
import { createPrivateMatchManifest } from "./privateMatchIssuer";
import { generatePrivateSolitaireSetup } from "../verified/solitaireSetup.v1.server";
import { SOLITAIRE_CORE_V1 } from "../verified/solitaireCore.v1.server";
import { solveKlondike } from "../solitaireSolver";
import type { MatchManifestV3 } from "../verified/contracts";

export const SOLITAIRE_DEAL_POLICY_V1 = Object.freeze({
  solverNodeLimit: 250_000,
  maxDraws: 16,
});

/** Same deck order as the solver: the 28 tableau cards column by column, then the stock (drawn from the END). */
export function solitaireDeckFromSeed(seed: string) {
  const setup = generatePrivateSolitaireSetup(seed);
  return [...setup.tableau.flat().map((card) => card.cardId), ...setup.stock];
}

export function isSolvableSolitaireSeed(seed: string) {
  return solveKlondike(solitaireDeckFromSeed(seed), SOLITAIRE_DEAL_POLICY_V1.solverNodeLimit).solved;
}

export function createSolitaireMatchManifest(
  issue: () => MatchManifestV3 = () =>
    createPrivateMatchManifest(SOLITAIRE_CORE_V1.gameId, SOLITAIRE_CORE_V1.gameVersion),
): MatchManifestV3 {
  for (let draw = 0; draw < SOLITAIRE_DEAL_POLICY_V1.maxDraws; draw++) {
    const manifest = issue();
    if (isSolvableSolitaireSeed(manifest.seed)) return manifest;
  }
  // (1/3)^16 ≈ 2·10⁻⁸: refuse rather than hand out a deal that may be unwinnable.
  throw new Error("SOLITAIRE_NO_SOLVABLE_DEAL");
}
