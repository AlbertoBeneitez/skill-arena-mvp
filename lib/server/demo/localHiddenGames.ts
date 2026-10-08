import { randomBytes, randomUUID } from "node:crypto";
import { MemoryMatchRepository } from "./memoryMatchRepository";
import { MemoryCommandAttemptRepository } from "./memoryCommandAttemptRepository";
import { HiddenCommandAuthority } from "../hiddenCommandAuthority";
import { createPrivateMatchManifest } from "../privateMatchIssuer";
import {
  MINE_GRID_CORE,
  projectMineState,
} from "../../verified/mineGridCore.v1";
import { CommandAuthorityError } from "../commandAttemptRepository";
import { hashManifest } from "../matchIntegrity";
/** Explicit local demo singleton. Never use process memory as Vercel persistence. */
function createLocalService() {
  const matches = new MemoryMatchRepository(),
    attempts = new MemoryCommandAttemptRepository();
  const authority = new HiddenCommandAuthority(
    matches,
    attempts,
    { core: MINE_GRID_CORE, project: projectMineState },
    "demo",
  );
  let count = 0;
  return {
    authority,
    async start(actorId: string) {
      if (count >= 200) throw new CommandAuthorityError("UNAVAILABLE");
      const manifest = createPrivateMatchManifest("mine-grid", "1.0.0"),
        attemptId = randomUUID();
      await matches.createMatch(manifest, {
        A: actorId,
        B: `demo-peer-${randomUUID()}`,
      });
      await attempts.create({
        attemptId,
        playerId: actorId,
        matchId: manifest.match_id,
        manifestHash: hashManifest(manifest),
        revision: 0,
        inputs: [],
        commands: [],
        terminal: false,
      });
      count++;
      return authority.read(attemptId, actorId);
    },
  };
}
const localGlobal = globalThis as typeof globalThis & {
  arenaLocalHiddenGames?: ReturnType<typeof createLocalService>;
};
export function getLocalHiddenGames() {
  if (
    process.env.ALLOW_LOCAL_HIDDEN_GAMES !== "1" ||
    process.env.VERCEL === "1"
  )
    throw new CommandAuthorityError("UNAVAILABLE");
  return (localGlobal.arenaLocalHiddenGames ??= createLocalService());
}
export function newLocalActor() {
  return randomBytes(32).toString("hex");
}
