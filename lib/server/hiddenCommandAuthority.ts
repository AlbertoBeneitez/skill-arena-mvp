import {
  replayCore,
  type CoreState,
  type GameCore,
} from "../verified/coreRuntime.v1";
import type {
  HiddenCommandRequest,
  HiddenPublicSession,
} from "../verified/hiddenCommandContracts";
import type { MatchManifest } from "../verified/contracts";
import { isPrivateScenario } from "./scenarios";
import { hashManifest } from "./matchIntegrity";
import type { MatchRepository } from "./matchRepository";
import {
  CommandAuthorityError,
  type CommandAttemptRepository,
  type StoredCommandAttempt,
} from "./commandAttemptRepository";
export type HiddenGamePolicy<S extends CoreState, V> = Readonly<{
  core: GameCore<S>;
  project(state: S): V;
  /**
   * Optional real-time limit, measured with the server's own clock from the attempt's creation. When it passes, the
   * server itself appends `timeUpAction` (a core action that ends the attempt) and the attempt closes at the deadline.
   */
  clock?: Readonly<{ limitMs: number; timeUpAction: string }>;
}>;
/** Command id the server uses when it closes an attempt for time. Clients cannot send it (ids are `[a-zA-Z0-9_-]`). */
export const SERVER_TIME_UP_COMMAND_ID = "server:time-up";
/** A mode of the existing replay pipeline, not a second simulation engine. */
export class HiddenCommandAuthority<S extends CoreState, V> {
  constructor(
    private readonly matches: MatchRepository,
    private readonly attempts: CommandAttemptRepository,
    private readonly policy: HiddenGamePolicy<S, V>,
    private readonly mode: "demo" | "production",
    private readonly now: () => number = () => Date.now(),
  ) {}
  private deadline(attempt: StoredCommandAttempt) {
    return this.policy.clock ? attempt.startedAtMs + this.policy.clock.limitMs : null;
  }
  /** Closes a running attempt whose deadline has passed: TIME_UP at the deadline, through the same atomic swap. */
  private async expire(attempt: StoredCommandAttempt, manifest: MatchManifest): Promise<StoredCommandAttempt> {
    const deadline = this.deadline(attempt);
    if (attempt.terminal || deadline === null || this.now() < deadline) return attempt;
    const action = this.policy.clock!.timeUpAction,
      inputs = [...attempt.inputs, { seq: attempt.inputs.length, tick: attempt.inputs.length, action }],
      replay = replayCore(this.policy.core, inputs, inputs.length - 1, manifest.seed, manifest.competition.target_score);
    if (!replay.valid || replay.state.status === "running")
      throw new CommandAuthorityError("CORRUPT_ATTEMPT");
    const next: StoredCommandAttempt = {
      ...attempt,
      revision: attempt.revision + 1,
      inputs,
      commands: [...attempt.commands, { commandId: SERVER_TIME_UP_COMMAND_ID, requestRevision: attempt.revision, action }],
      terminal: true,
      finishedAtMs: deadline,
    };
    if (await this.attempts.compareAndSwap(attempt.revision, next)) return next;
    // Someone else moved first (the player's last command or a concurrent read): use what was stored.
    const stored = await this.attempts.findForPlayer(attempt.attemptId, attempt.playerId);
    if (!stored) throw new CommandAuthorityError("NOT_FOUND");
    return stored.terminal ? stored : this.expire(stored, manifest);
  }
  private async load(attemptId: string, actorId: string) {
    const attempt = await this.attempts.findForPlayer(attemptId, actorId);
    if (!attempt) throw new CommandAuthorityError("NOT_FOUND");
    const match = await this.matches.findMatchForPlayer(
      attempt.matchId,
      actorId,
    );
    if (
      !match ||
      match.manifestHash !== attempt.manifestHash ||
      hashManifest(match.manifest) !== attempt.manifestHash
    )
      throw new CommandAuthorityError("CORRUPT_ATTEMPT");
    const core = this.policy.core,
      manifest = match.manifest;
    if (
      manifest.game_id !== core.gameId ||
      manifest.game_version !== core.gameVersion ||
      manifest.manifest_version !== 3 ||
      !isPrivateScenario(manifest.scenario)
    )
      throw new CommandAuthorityError("CORRUPT_ATTEMPT");
    return { attempt, manifest };
  }
  private view(
    attempt: StoredCommandAttempt,
    manifest: MatchManifest,
    computed?: ReturnType<typeof replayCore<S>>,
  ) {
    const inputs = [...attempt.inputs],
      tick = inputs.at(-1)?.tick ?? 0;
    const replay =
      computed ??
      replayCore(
        this.policy.core,
        inputs,
        tick,
        manifest.seed,
        manifest.competition.target_score,
      );
    if (!replay.valid && replay.error !== "CLIENT_ENDED_BEFORE_RESOLUTION")
      throw new CommandAuthorityError("CORRUPT_ATTEMPT");
    if (attempt.terminal !== (replay.state.status !== "running"))
      throw new CommandAuthorityError("CORRUPT_ATTEMPT");
    const session: HiddenPublicSession<V> = {
      mode: this.mode,
      attemptId: attempt.attemptId,
      matchId: attempt.matchId,
      gameId: manifest.game_id,
      gameVersion: manifest.game_version,
      scenarioId:
        manifest.manifest_version === 3 ? manifest.scenario.scenario_id : "",
      revision: attempt.revision,
      status: replay.state.status,
      score: replay.score,
      failure: replay.failure,
      view: this.policy.project(replay.state),
      verified: replay.valid,
      ...(this.policy.clock
        ? {
            timeLimitMs: this.policy.clock.limitMs,
            elapsedMs: Math.max(
              0,
              Math.min(this.policy.clock.limitMs, (attempt.finishedAtMs ?? this.now()) - attempt.startedAtMs),
            ),
          }
        : {}),
    };
    return session;
  }
  async read(attemptId: string, actorId: string) {
    const { attempt, manifest } = await this.load(attemptId, actorId);
    return this.view(await this.expire(attempt, manifest), manifest);
  }
  async command(request: HiddenCommandRequest, actorId: string) {
    if (
      !request ||
      typeof request !== "object" ||
      Array.isArray(request) ||
      Object.keys(request).sort().join(",") !==
        "action,attemptId,commandId,expectedRevision" ||
      typeof request.attemptId !== "string" ||
      request.attemptId.length > 128 ||
      typeof request.commandId !== "string" ||
      !/^[a-zA-Z0-9_-]{1,96}$/.test(request.commandId) ||
      !Number.isSafeInteger(request.expectedRevision) ||
      request.expectedRevision < 0 ||
      typeof request.action !== "string" ||
      !this.policy.core.actions.includes(request.action)
    )
      throw new CommandAuthorityError("INVALID_COMMAND");
    const { attempt, manifest } = await this.load(request.attemptId, actorId);
    const previous = attempt.commands.find(
      (c) => c.commandId === request.commandId,
    );
    if (previous) {
      if (
        previous.requestRevision !== request.expectedRevision ||
        previous.action !== request.action
      )
        throw new CommandAuthorityError("COMMAND_CONFLICT");
      return this.view(attempt, manifest);
    }
    if (attempt.terminal) throw new CommandAuthorityError("ATTEMPT_CLOSED");
    // Past the deadline the move is not applied: the attempt closes for time and the player gets the final view.
    const expired = await this.expire(attempt, manifest);
    if (expired.terminal) return this.view(expired, manifest);
    if (attempt.revision !== request.expectedRevision)
      throw new CommandAuthorityError("REVISION_CONFLICT");
    const inputs = [
        ...attempt.inputs,
        {
          seq: attempt.inputs.length,
          tick: attempt.inputs.length,
          action: request.action,
        },
      ],
      tick = inputs.at(-1)!.tick;
    const replay = replayCore(
      this.policy.core,
      inputs,
      tick,
      manifest.seed,
      manifest.competition.target_score,
    );
    if (!replay.valid && replay.error !== "CLIENT_ENDED_BEFORE_RESOLUTION")
      throw new CommandAuthorityError("INVALID_COMMAND");
    const next: StoredCommandAttempt = {
      ...attempt,
      revision: attempt.revision + 1,
      inputs,
      commands: [
        ...attempt.commands,
        {
          commandId: request.commandId,
          requestRevision: request.expectedRevision,
          action: request.action,
        },
      ],
      terminal: replay.state.status !== "running",
      finishedAtMs: replay.state.status !== "running" ? this.now() : null,
    };
    if (!(await this.attempts.compareAndSwap(attempt.revision, next))) {
      const retry = await this.attempts.findForPlayer(
          request.attemptId,
          actorId,
        ),
        accepted = retry?.commands.find(
          (c) => c.commandId === request.commandId,
        );
      if (
        retry &&
        accepted &&
        accepted.requestRevision === request.expectedRevision &&
        accepted.action === request.action
      )
        return this.view(retry, manifest);
      if (accepted) throw new CommandAuthorityError("COMMAND_CONFLICT");
      throw new CommandAuthorityError("REVISION_CONFLICT");
    }
    return this.view(next, manifest, replay);
  }
}
