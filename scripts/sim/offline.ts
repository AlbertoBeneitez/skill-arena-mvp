/** Bot simulator · offline check: each style on each generic core, then the server's own replay of the inputs. */
import { GAMES, lowerScoreWins } from "@/lib/games";
import { getServerGameAdapter } from "@/lib/server/gameVerifiers";
import { loadCores } from "./cores";
import { playMatch, type Style } from "./policies";

const cores = await loadCores();
const only = process.argv[2];
for (const g of GAMES.filter((x) => x.enabled && (!only || x.id === only))) {
  const core = cores.get(`${g.id}@${g.version}`);
  const adapter = getServerGameAdapter(g.id, g.version);
  if (!core || !adapter) { console.log(`${g.id}: sin núcleo genérico (${g.competition.verification})`); continue; }
  const row: string[] = [];
  for (const style of ["novice", "medium", "expert"] as Style[]) {
    const seed = `sim-offline-${g.id}-1`;
    const r = playMatch(core, seed, style, `b-${style}`, lowerScoreWins(g), 1e9, 45_000);
    const manifest = { seed, competition: { target_score: 1e9 } } as never;
    const rep = adapter.replay({ inputs: r.inputs, finalTick: r.finalTick, manifest } as never) as { valid: boolean; error?: string; score: number };
    row.push(`${style}: ${r.score} (${r.status}${r.failure ? " " + r.failure : ""}, ${r.inputs.length} entradas, ${r.cpuMs} ms) replay ${rep.valid ? "OK " + rep.score : "FALLA " + rep.error}`);
  }
  console.log(`${g.id}@${g.version}\n  ${row.join("\n  ")}`);
}
