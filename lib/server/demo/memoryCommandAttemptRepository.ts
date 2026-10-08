import {
  CommandAuthorityError,
  type CommandAttemptRepository,
  type StoredCommandAttempt,
} from "../commandAttemptRepository";
/** Local/test only. Production factories must never fall back to this adapter. */
export class MemoryCommandAttemptRepository
  implements CommandAttemptRepository
{
  private readonly records = new Map<string, StoredCommandAttempt>();
  async create(record: StoredCommandAttempt) {
    if (
      record.revision !== 0 ||
      record.inputs.length ||
      record.commands.length ||
      record.terminal
    )
      throw new CommandAuthorityError("CORRUPT_ATTEMPT");
    if (this.records.has(record.attemptId) || [...this.records.values()].some(r=>r.matchId===record.matchId&&r.playerId===record.playerId))
      throw new CommandAuthorityError("COMMAND_CONFLICT");
    this.records.set(record.attemptId, structuredClone(record));
  }
  async findForPlayer(attemptId: string, playerId: string) {
    const found = this.records.get(attemptId);
    return found?.playerId === playerId ? structuredClone(found) : null;
  }
  async compareAndSwap(expectedRevision: number, next: StoredCommandAttempt) {
    const before = this.records.get(next.attemptId);
    if (!before || before.revision !== expectedRevision || before.terminal)
      return false;
    if (
      next.inputs.length !== next.revision ||
      next.commands.length !== next.revision ||
      JSON.stringify(next.inputs.slice(0, -1)) !==
        JSON.stringify(before.inputs) ||
      JSON.stringify(next.commands.slice(0, -1)) !==
        JSON.stringify(before.commands) ||
      next.revision !== before.revision + 1 ||
      next.playerId !== before.playerId ||
      next.matchId !== before.matchId ||
      next.manifestHash !== before.manifestHash
    )
      throw new CommandAuthorityError("CORRUPT_ATTEMPT");
    this.records.set(next.attemptId, structuredClone(next));
    return true;
  }
}
