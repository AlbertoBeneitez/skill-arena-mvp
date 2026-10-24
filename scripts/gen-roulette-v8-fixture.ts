import { writeFileSync } from "node:fs";
import { sha256 } from "../lib/server/matchIntegrity";
import { canonicalJson } from "../lib/verified/canonical";
import { ROULETTE_CORE_V8 as core } from "../lib/verified/galacticRouletteCore.v8";
import { rouletteTossAction } from "../lib/verified/galacticRouletteProtocol.v3";
import { applyCoreInput, stepCore } from "../lib/verified/coreRuntime.v1";
const seed = "roulette7-golden";
const s = core.create(seed), inputs: { seq: number; tick: number; action: string }[] = [];
const send = (a: string) => { if (core.canApply(s, a)) { inputs.push({ seq: inputs.length, tick: s.tick, action: a }); applyCoreInput(core, s, a, 1e9); stepCore(core, s, 1e9); return true; } return false; };
for (let spin = 0; spin < 4; spin++) {
  send("CHIP_5"); send("BET_RED"); send("CHIP_1"); send("BET_NUMBER_17"); send("CHIP_25"); send("BET_DOZEN_2");
  send(rouletteTossAction(10 + spin * 5, 6 + spin));
  while (s.landingTick !== -1 && s.status === "running") stepCore(core, s, 1e9);
  for (let i = 0; i < 6; i++) stepCore(core, s, 1e9);
}
send("CASH_OUT");
writeFileSync("scripts/fixtures/roulette-v8.json", JSON.stringify({ seed, inputs, score: s.score, finalTick: s.tick, status: s.status, failure: s.failure, hash: sha256(canonicalJson(s)) }, null, 1));
console.log(s.status, s.score, s.tick, inputs.length);
