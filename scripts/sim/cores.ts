/**
 * Bot simulator · the frozen game cores the server replays, found by game id and version. Bots generate their inputs
 * with the very same pure core (lib/verified), so a match they submit is exactly what a real phone would send.
 */
import { readdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import type { CoreState, GameCore } from "@/lib/verified/coreRuntime.v1";

export type AnyCore = GameCore<CoreState>;
const isCore = (v: unknown): v is AnyCore =>
  !!v && typeof v === "object" && typeof (v as AnyCore).create === "function" && typeof (v as AnyCore).step === "function"
  && typeof (v as AnyCore).apply === "function" && typeof (v as AnyCore).canApply === "function" && typeof (v as AnyCore).gameId === "string";

export async function loadCores(): Promise<Map<string, AnyCore>> {
  const here = dirname(fileURLToPath(import.meta.url));
  const dir = join(here, "..", "..", "lib", "verified");
  const out = new Map<string, AnyCore>();
  for (const file of readdirSync(dir).filter((f) => /Core(\.v\d+)?\.js$/.test(f))) {
    const mod = await import(pathToFileURL(join(dir, file)).href);
    for (const value of Object.values(mod)) if (isCore(value)) out.set(`${value.gameId}@${value.gameVersion}`, value);
  }
  return out;
}
