import { writeFileSync } from "node:fs";
import { seededShuffle } from "../lib/deterministic/seeded";
import { replaySolution, solveKlondike } from "../lib/solitaireSolver";
const want = Number(process.argv[2] ?? 60);
const out: { id: string; deck: number[]; verifiedMoves: number; stockDraws: number }[] = [];
let tried = 0;
for (let n = 0; out.length < want && n < want * 6; n++) {
  tried++;
  const deck = seededShuffle(Array.from({ length: 52 }, (_, i) => i), `solitaire-pool-v104-${n}`);
  const r = solveKlondike(deck, 250_000);
  if (!r.solved) continue;
  const replay = replaySolution(deck, r.moves);
  if (!replay.won) throw new Error("replay failed " + n);
  out.push({ id: `P-${String(n).padStart(3, "0")}`, deck, verifiedMoves: r.moves.length, stockDraws: replay.draws });
}
writeFileSync("scripts/fixtures/solitaire-pool.json", JSON.stringify(out));
console.log(`generated ${out.length}/${tried} solvable decks`);
