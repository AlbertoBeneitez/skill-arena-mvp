import type { ReplayInput } from "../verified/inputValidation";
export type AcceptedCommand = Readonly<{
  commandId: string;
  requestRevision: number;
  action: string;
}>;
/** Server-only record. A client receives only an explicit game public projection. */
export type StoredCommandAttempt = Readonly<{
  attemptId: string;
  matchId: string;
  playerId: string;
  revision: number;
  manifestHash: string;
  inputs: readonly ReplayInput[];
  commands: readonly AcceptedCommand[];
  terminal: boolean;
}>;
export interface CommandAttemptRepository {
  create(record: StoredCommandAttempt): Promise<void>;
  findForPlayer(
    attemptId: string,
    playerId: string,
  ): Promise<StoredCommandAttempt | null>;
  /** Must atomically compare revision and insert once; no last-write-wins update. */
  compareAndSwap(
    expectedRevision: number,
    next: StoredCommandAttempt,
  ): Promise<boolean>;
}
export class CommandAuthorityError extends Error {
  constructor(
    public readonly code:
      | "INVALID_COMMAND"
      | "NOT_FOUND"
      | "REVISION_CONFLICT"
      | "COMMAND_CONFLICT"
      | "ATTEMPT_CLOSED"
      | "CORRUPT_ATTEMPT"
      | "UNAVAILABLE",
  ) {
    super(code);
    this.name = "CommandAuthorityError";
  }
}
