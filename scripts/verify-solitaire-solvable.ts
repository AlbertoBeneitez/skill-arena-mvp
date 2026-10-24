import assert from "node:assert/strict";
import { SOLITAIRE_CHALLENGES } from "../lib/deterministic/challengeSets";
import { replaySolution, solveKlondike } from "../lib/solitaireSolver";
// Every deal the game can hand out must be completable: solve it and replay with the literal client mechanics.
for (const challenge of SOLITAIRE_CHALLENGES) {
  assert.equal(challenge.deck.length, 52);
  assert.deepEqual([...challenge.deck].sort((a, b) => a - b), Array.from({ length: 52 }, (_, i) => i));
  const result = solveKlondike(challenge.deck, 600_000);
  assert.equal(result.solved, true, `${challenge.id} must be solvable`);
  assert.equal(replaySolution(challenge.deck, result.moves).won, true, `${challenge.id} replay must win`);
}
console.log(`Solitaire: ${SOLITAIRE_CHALLENGES.length} deals, all solvable (solver + literal replay)`);
