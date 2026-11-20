// Bot simulator · plays one match on the core in its own thread, so a long think never freezes the other bots.
import { register } from "node:module";
import { parentPort } from "node:worker_threads";
register("./loader.mjs", import.meta.url);
const { playMatch } = await import("../../.sim-build/scripts/sim/policies.js");
const { loadCores } = await import("../../.sim-build/scripts/sim/cores.js");
const cores = await loadCores();
parentPort.on("message", ({ id, key, seed, style, botSeed, lowerWins, target, budgetMs }) => {
  try { parentPort.postMessage({ id, result: playMatch(cores.get(key), seed, style, botSeed, lowerWins, target, budgetMs) }); }
  catch (e) { parentPort.postMessage({ id, error: String(e) }); }
});
