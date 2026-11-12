// npm run check — the same determinism test Galactic Games runs before integrating a game.
// Three seeds, each played twice with the same seeded random inputs: the final states must be identical; another
// seed must give another match; every match must end by maxFinalTick with an integer score >= 0.
import { createRng } from "../kit/seeded";
import { replay, type ReplayInput } from "../kit/core";
import { core } from "../src/core";
import manifest from "../galactic.json";

const fail = (msg: string) => { console.error(`✕ ${msg}`); process.exit(1); };
const script = (seed: string): ReplayInput[] => {
  const rng = createRng(`${seed}:script`), out: ReplayInput[] = [];
  for (let t = rng.nextInt(20); t < core.maxFinalTick; t += 1 + rng.nextInt(40)) out.push({ tick: t, action: core.actions[rng.nextInt(core.actions.length)] });
  return out;
};
if (manifest.id !== core.gameId || manifest.version !== core.gameVersion) fail("galactic.json id/version must match core.gameId/gameVersion");
if (manifest.tickRate !== core.tickRate || manifest.maxTicks !== core.maxFinalTick) fail("galactic.json tickRate/maxTicks must match the core");
if (manifest.width !== core.width || manifest.height !== core.height) fail("galactic.json width/height must match the core");
if (JSON.stringify(manifest.actions) !== JSON.stringify(core.actions)) fail("galactic.json actions must match core.actions");
const results: string[] = [];
for (const seed of ["gg-check-a", "gg-check-b", "gg-check-c"]) {
  const a = replay(core, seed, script(seed)), b = replay(core, seed, script(seed));
  if (JSON.stringify(a) !== JSON.stringify(b)) fail(`seed ${seed}: two replays differ (something besides the seed and inputs changes the result)`);
  if (a.status === "running") fail(`seed ${seed}: the match did not end`);
  if (!Number.isInteger(a.score) || a.score < 0) fail(`seed ${seed}: score ${a.score} is not an integer >= 0`);
  results.push(JSON.stringify(a));
}
const other = JSON.stringify(replay(core, "gg-check-b", script("gg-check-a")));
if (other === results[0]) fail("the seed does not change the match");
console.log("✓ deterministic · seeded · ends by maxFinalTick · integer score");
