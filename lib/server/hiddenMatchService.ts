/**
 * Paired matches for hidden-information games (Mine Grid 2.0.0, Solitaire Sprint 1.0.0).
 *
 * Not a second match system: pairing, the stored attempt, the deadline and lease, the winner decision, groups,
 * rankings and play counts are the public-match pipeline (`arena_public_attempts`), exactly as for the other games.
 * The only difference is how the attempt is played. The phone never receives the manifest, seed or ticket; it plays
 * one move per command through `HiddenCommandAuthority` and sees only the public projection. The second player joins
 * the first player's stored match, so both get the same private manifest: the same field, the same deal.
 * When the command attempt ends, the server writes the public record and the authoritative result itself.
 */
import { canonicalJson } from "../verified/canonical";
import { getGameDefinition } from "../games";
import { replayCore, type CoreState } from "../verified/coreRuntime.v1";
import type { MatchManifest, MatchManifestV3, VerifiedAttemptResult } from "../verified/contracts";
import { HEARTBEAT_MS, PUBLIC_MATCH_POLICY, type PublicRecord } from "../publicMatch";
import { isPlatform, type Platform } from "../platform";
import { SOLITAIRE_CORE_V1, projectSolitaireV1 } from "../verified/solitaireCore.v1.server";
import { SOLITAIRE_V1_TIME_LIMIT_MS } from "../verified/solitaireProtocol.v1";
import { MINE_GRID_CORE_V2, projectMineV2 } from "../verified/mineGridCore.v2";
import { HiddenCommandAuthority, type HiddenGamePolicy } from "./hiddenCommandAuthority";
import { createSolitaireMatchManifest } from "./solitaireDeals";
import { createPrivateMatchManifest } from "./privateMatchIssuer";
import { issueAttemptTicket } from "./verifiedMatch";
import { hashManifest, sha256 } from "./matchIntegrity";
import { isPrivateScenario } from "./scenarios";
import type { MatchRepository } from "./matchRepository";
import { CommandAuthorityError, type CommandAttemptRepository } from "./commandAttemptRepository";
import { PublicAttemptError, type PublicAttempt, type PublicAttemptRepository } from "./publicAttemptRepository";

/** Same value as `ABANDONED_LOWER_WINS_SCORE` (lib/server/groups.ts): worse than any real time. */
export const UNSOLVED_LOWER_WINS_SCORE = 999_999;

type HiddenMatchGame = Readonly<{
  gameVersion: string;
  /** Public-attempt deadline: the game's own limit plus a margin (the lease still forfeits a silent phone). */
  durationMs: number;
  issue(): MatchManifestV3;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  policy: HiddenGamePolicy<any, unknown>;
  /** Authoritative ranking score from the server replay and the server-measured time. */
  score(replay: { won: boolean; score: number }, elapsedMs: number): number;
}>;

export const HIDDEN_MATCH_GAMES: Readonly<Record<string, HiddenMatchGame>> = Object.freeze({
  // Owner, 22-nov-2026: the same deal for both; the fastest solve wins; unsolved after 5 minutes loses.
  // "Less is better" (LOWER_SCORE_WINS_GAMES) follows the catalogue and is switched on with Solitaire 1.0.0 there.
  "solitaire-sprint": {
    gameVersion: SOLITAIRE_CORE_V1.gameVersion,
    durationMs: SOLITAIRE_V1_TIME_LIMIT_MS + 30_000,
    issue: () => createSolitaireMatchManifest(),
    policy: {
      core: SOLITAIRE_CORE_V1,
      project: projectSolitaireV1,
      clock: { limitMs: SOLITAIRE_V1_TIME_LIMIT_MS, timeUpAction: "TIME_UP" },
    },
    score: (replay, elapsedMs) => (replay.won ? elapsedMs : UNSOLVED_LOWER_WINS_SCORE),
  },
  // Owner, 22-nov-2026: both players must get the same field. Score and rules of Mine Grid 2.0.0 unchanged.
  "mine-grid": {
    gameVersion: MINE_GRID_CORE_V2.gameVersion,
    durationMs: 15 * 60_000,
    issue: () => createPrivateMatchManifest("mine-grid", MINE_GRID_CORE_V2.gameVersion),
    policy: { core: MINE_GRID_CORE_V2, project: projectMineV2 },
    score: (replay) => replay.score,
  },
});

export function hiddenMatchGameFor(manifest: Pick<MatchManifest, "game_id" | "game_version">) {
  const game = HIDDEN_MATCH_GAMES[manifest.game_id];
  return game && game.gameVersion === manifest.game_version ? game : null;
}

const PERSISTENCE = Object.freeze({ durable: true, policy_version: PUBLIC_MATCH_POLICY, heartbeat_interval_ms: HEARTBEAT_MS });
const UUID4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export class HiddenMatchService {
  constructor(
    private readonly publicAttempts: PublicAttemptRepository,
    private readonly matches: MatchRepository,
    private readonly commands: CommandAttemptRepository,
    private readonly now: () => number = () => Date.now(),
  ) {}

  private authority(game: HiddenMatchGame) {
    return new HiddenCommandAuthority(this.matches, this.commands, game.policy, "production", this.now);
  }

  private gameOf(row: PublicAttempt) {
    const game = hiddenMatchGameFor(row.manifest);
    if (!game || row.manifest.manifest_version !== 3 || !isPrivateScenario(row.manifest.scenario))
      throw new PublicAttemptError("NOT_A_HIDDEN_MATCH", 400);
    return game;
  }

  /** The command attempt shares the public attempt's id; created once, right after the public start. */
  private async ensureCommandAttempt(row: PublicAttempt) {
    if (await this.commands.findForPlayer(row.attempt_id, row.player_id)) return;
    try {
      await this.commands.create({
        attemptId: row.attempt_id,
        playerId: row.player_id,
        matchId: row.match_id,
        manifestHash: hashManifest(row.manifest),
        revision: 0,
        inputs: [],
        commands: [],
        terminal: false,
        startedAtMs: this.now(),
        finishedAtMs: null,
      });
    } catch (error) {
      // A concurrent recovery of the same start created it first.
      if (!(error instanceof CommandAuthorityError && error.code === "COMMAND_CONFLICT")) throw error;
      if (!(await this.commands.findForPlayer(row.attempt_id, row.player_id))) throw error;
    }
  }

  async start(actor: string, raw: unknown, accountId: string | null = null) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      throw new PublicAttemptError("INVALID_START", 400);
    const body = raw as Record<string, unknown>;
    const keys = Object.keys(body).filter((k) => k !== "solo").sort().join(",");
    if (
      (body.solo !== undefined && body.solo !== true) ||
      (keys !== "game_id,stake_minor,start_key" && keys !== "game_id,platform,stake_minor,start_key") ||
      (body.platform !== undefined && !isPlatform(body.platform)) ||
      typeof body.game_id !== "string" ||
      typeof body.start_key !== "string" ||
      !UUID4.test(body.start_key) ||
      // Owner, 21-nov-2026: no money for now. These games are played without an entry.
      body.stake_minor !== 0
    )
      throw new PublicAttemptError("INVALID_START", 400);
    const game = HIDDEN_MATCH_GAMES[body.game_id];
    if (!game || !getGameDefinition(body.game_id)?.enabled)
      throw new PublicAttemptError("UNSUPPORTED_GAME_VERSION", 400);
    const platform: Platform = isPlatform(body.platform) ? body.platform : "mobile";
    const requestHash = sha256(
      canonicalJson({ game: body.game_id, mode: "hidden-commands-v1", platform, solo: body.solo === true, stake: 0 }),
    );
    let row = await this.publicAttempts.recoverStart(actor, body.start_key, requestHash);
    if (!row) {
      // Issued before the start transaction: Solitaire runs the solver here, never inside the pairing lock.
      // A player who joins an existing match plays that match's manifest and this one is simply not stored.
      const manifest = game.issue();
      row = await this.publicAttempts.start({
        actor,
        key: body.start_key,
        requestHash,
        gameId: body.game_id,
        gameVersion: game.gameVersion,
        stake: 0,
        platform,
        accountId,
        solo: body.solo === true,
        durationMs: game.durationMs,
        manifest: () => manifest,
        ticket: (stored, slot) => issueAttemptTicket({ manifest: stored, playerId: actor, slot, ttlMinutes: 30 }),
      });
    }
    this.gameOf(row);
    if (row.state === "playing") await this.ensureCommandAttempt(row);
    return this.answer(actor, row);
  }

  /** What the phone gets: never the manifest, seed or ticket. */
  private async answer(actor: string, row: PublicAttempt) {
    const game = this.gameOf(row);
    const session = (await this.commands.findForPlayer(row.attempt_id, actor))
      ? await this.authority(game).read(row.attempt_id, actor)
      : null;
    if (session && session.status !== "running" && !["verified", "rejected", "forfeited"].includes(row.state))
      row = await this.finalize(actor, row.attempt_id);
    return {
      ok: true,
      attempt_id: row.attempt_id,
      state: row.state,
      persistence: PERSISTENCE,
      session,
      result: row.response ? { ...row.response, match: await this.publicAttempts.view(actor, row.attempt_id) } : null,
    };
  }

  async read(actor: string, attemptId: string) {
    if (typeof attemptId !== "string" || attemptId.length > 128) throw new PublicAttemptError("INVALID_RECORD", 400);
    return this.answer(actor, await this.publicAttempts.inspect(actor, attemptId));
  }

  async command(actor: string, raw: unknown) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw) || typeof (raw as { attemptId?: unknown }).attemptId !== "string")
      throw new CommandAuthorityError("INVALID_COMMAND");
    const request = raw as { attemptId: string; commandId: string; expectedRevision: number; action: string };
    if (request.attemptId.length > 128) throw new CommandAuthorityError("INVALID_COMMAND");
    const row = await this.publicAttempts.inspect(actor, request.attemptId);
    const game = this.gameOf(row);
    // A forfeited attempt (lease lost, abandoned, deadline) takes no more moves.
    if (row.state !== "playing") return this.answer(actor, row);
    await this.publicAttempts.pulse(actor, row.attempt_id, false);
    const session = await this.authority(game).command(request, actor);
    if (session.status === "running")
      return { ok: true, attempt_id: row.attempt_id, state: row.state, persistence: PERSISTENCE, session, result: null };
    return this.answer(actor, await this.publicAttempts.inspect(actor, row.attempt_id));
  }

  /** Writes the public record and the authoritative result once the command attempt has ended. Idempotent. */
  private async finalize(actor: string, attemptId: string): Promise<PublicAttempt> {
    const stored = await this.commands.findForPlayer(attemptId, actor);
    if (!stored?.terminal || stored.finishedAtMs === null) throw new PublicAttemptError("ATTEMPT_RUNNING", 409);
    const record: PublicRecord = {
      inputs: stored.inputs.map((i) => ({ seq: i.seq, tick: i.tick, action: i.action })),
      final_tick: stored.inputs.at(-1)?.tick ?? 0,
    };
    let row = await this.publicAttempts.receive(actor, attemptId, sha256(canonicalJson(record)), record);
    if (row.response) return row;
    const claimed = await this.publicAttempts.claim(actor, attemptId);
    if (!claimed) return this.publicAttempts.inspect(actor, attemptId);
    const game = this.gameOf(claimed);
    const replay = replayCore<CoreState>(game.policy.core, [...stored.inputs], record.final_tick, claimed.manifest.seed, claimed.manifest.competition.target_score);
    const elapsedMs = Math.max(0, stored.finishedAtMs - stored.startedAtMs);
    const response: VerifiedAttemptResult =
      replay.valid && replay.state.status !== "running"
        ? {
            ok: true,
            verified: true,
            durable: true,
            attempt_id: attemptId,
            authoritative_source: "SERVER_REPLAY",
            score: game.score(replay, elapsedMs),
            time_ms: elapsedMs,
            height: replay.height,
            won: replay.won,
            failure: replay.failure,
          }
        : { ok: false, verified: false, durable: true, attempt_id: attemptId, error: replay.error ?? "INVALID_REPLAY" };
    await this.publicAttempts.audit(actor, attemptId, claimed.record_hash!, { valid: replay.valid, error: replay.error ?? null, elapsedMs });
    row = await this.publicAttempts.complete(actor, attemptId, claimed.processing_token!, response);
    return row;
  }
}
