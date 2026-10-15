import { canonicalJson } from "../verified/canonical";
import { getGameDefinition } from "../games";
import { validateInputSequence } from "../verified/inputValidation";
import type {
  VerifiedAttemptResult,
  MatchManifestV3,
} from "../verified/contracts";
import {
  PUBLIC_MATCH_POLICY,
  HEARTBEAT_MS,
  type PublicRecord,
} from "../publicMatch";
import { generateScenario } from "./scenarios";
import {
  createMatchManifest,
  hashManifest,
  issueAttemptTicket,
  isAllowedStakeMinor,
  processAttemptRecord,
} from "./verifiedMatch";
import { sha256 } from "./matchIntegrity";
import { getServerGameAdapter } from "./gameVerifiers";
import {
  PublicAttemptError,
  type PublicAttempt,
  type PublicAttemptRepository,
} from "./publicAttemptRepository";
/** Application orchestration; repository is responsible for atomic durable state. */
export class PublicMatchService {
  constructor(private readonly repository: PublicAttemptRepository) {}
  async start(actor: string, raw: unknown) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      throw new PublicAttemptError("INVALID_START", 400);
    const body = raw as Record<string, unknown>;
    if (
      Object.keys(body).sort().join(",") !== "game_id,stake_minor,start_key" ||
      typeof body.game_id !== "string" ||
      typeof body.start_key !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        body.start_key,
      ) ||
      !Number.isInteger(body.stake_minor) ||
      !isAllowedStakeMinor(body.stake_minor as number)
    )
      throw new PublicAttemptError("INVALID_START", 400);
    const game = getGameDefinition(body.game_id),
      adapter = getServerGameAdapter(body.game_id);
    if (
      !game?.enabled ||
      game.competition.verification !== "server-replay" ||
      !adapter
    )
      throw new PublicAttemptError("UNSUPPORTED_GAME_VERSION", 400);
    const row = await this.repository.start({
      actor,
      key: body.start_key,
      requestHash: sha256(
        canonicalJson({
          game: game.id,
          version: game.version,
          stake: body.stake_minor,
        }),
      ),
      gameId: game.id,
      gameVersion: game.version,
      stake: body.stake_minor as number,
      durationMs:
        Math.ceil(
          (adapter.simulation.maxFinalTick / adapter.simulation.tickRate) *
            1000,
        ) + 5000,
      manifest: (index) => {
        const scenario = generateScenario(
          { game_id: game.id, game_version: game.version },
          index,
        );
        const base = createMatchManifest({
          gameId: game.id,
          gameVersion: game.version,
          stakeMinor: body.stake_minor as number,
          targetScore: 1e9,
          seed: scenario.seed,
        });
        return {
          ...base,
          manifest_version: 3,
          scenario: scenario.scenario,
        } satisfies MatchManifestV3;
      },
      ticket: (manifest, slot) =>
        issueAttemptTicket({ manifest, playerId: actor, slot, ttlMinutes: 30 }),
    });
    return {
      ok: true,
      manifest: row.manifest,
      manifest_hash: hashManifest(row.manifest),
      ticket: row.ticket,
      persistence: {
        durable: true,
        policy_version: PUBLIC_MATCH_POLICY,
        heartbeat_interval_ms: HEARTBEAT_MS,
      },
      state: row.state,
    };
  }
  async pulse(actor: string, id: string, abandon = false) {
    const row = await this.repository.pulse(actor, id, abandon);
    return { ok: true, state: row.state, ...row.response };
  }
  async submit(
    actor: string,
    raw: unknown,
  ): Promise<{ status: number; body: VerifiedAttemptResult }> {
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      throw new PublicAttemptError("INVALID_RECORD", 400);
    const b = raw as Record<string, unknown>;
    const keys = Object.keys(b).sort().join(",");
    if (
      ![
        "attempt_id,final_tick,inputs",
        "attempt_id,final_tick,inputs,record_kind",
      ].includes(keys) ||
      typeof b.attempt_id !== "string" ||
      b.attempt_id.length > 128 ||
      (b.record_kind !== undefined && b.record_kind !== "abandoned")
    )
      throw new PublicAttemptError("INVALID_RECORD", 400);
    // Resolve the authoritative manifest from storage; no browser seed/ticket/result accepted.
    const current = await this.repository.inspect(actor, b.attempt_id);
    const adapter = getServerGameAdapter(
      current.manifest.game_id,
      current.manifest.game_version,
    );
    if (!adapter) throw new PublicAttemptError("UNSUPPORTED_GAME_VERSION", 400);
    const error = validateInputSequence(b.inputs, b.final_tick, {
      ...adapter.inputProtocol,
      maxFinalTick: adapter.simulation.maxFinalTick,
    });
    if (error) throw new PublicAttemptError(error, 400);
    const record: PublicRecord = {
      inputs: (b.inputs as PublicRecord["inputs"]).map((i) => ({
        seq: i.seq,
        tick: i.tick,
        action: i.action,
      })),
      final_tick: b.final_tick as number,
      ...(b.record_kind ? { record_kind: "abandoned" as const } : {}),
    };
    const hash = sha256(canonicalJson(record));
    const row = await this.repository.receive(
      actor,
      b.attempt_id,
      hash,
      record,
    );
    return this.verify(actor, row);
  }
  private async verify(
    actor: string,
    row: PublicAttempt,
  ): Promise<{ status: number; body: VerifiedAttemptResult }> {
    if (!row.response) {
      const claimed = await this.repository.claim(actor, row.attempt_id);
      if (!claimed)
        return {
          status: 202,
          body: {
            ok: true,
            verified: false,
            durable: true,
            processing: true,
            attempt_id: row.attempt_id,
          },
        };
      const checked = this.replay(claimed);
      await this.repository.audit(
        actor,
        row.attempt_id,
        claimed.record_hash!,
        checked,
      );
      const response: VerifiedAttemptResult =
        claimed.record?.record_kind === "abandoned"
          ? {
              ok: true,
              verified: false,
              durable: true,
              forfeited: true,
              attempt_id: row.attempt_id,
              error: "ATTEMPT_FORFEITED",
              failure: "ABANDONED",
            }
          : { ...checked.body, durable: true, attempt_id: row.attempt_id };
      row = await this.repository.complete(
        actor,
        row.attempt_id,
        claimed.processing_token!,
        response,
      );
    }
    if (row.response?.forfeited && row.record && !row.replay_audit)
      await this.repository.audit(
        actor,
        row.attempt_id,
        row.record_hash!,
        this.replay(row),
      );
    if (!row.response)
      return {
        status: 202,
        body: { ok: true, verified: false, durable: true, processing: true },
      };
    return {
      status: 200,
      body: {
        ...row.response,
        match: await this.repository.view(actor, row.attempt_id),
      },
    };
  }
  private replay(row: PublicAttempt) {
    const receivedAt = row.record_received_at?.getTime();
    if (receivedAt === undefined || !Number.isFinite(receivedAt))
      throw new PublicAttemptError("CORRUPT_RECORD", 503);
    const elapsed = receivedAt - Date.parse(row.ticket.issued_at);
    if (
      (row.record!.final_tick * 1000) / row.manifest.simulation.tick_rate >
      elapsed + 2500
    )
      return {
        status: 409,
        body: {
          ok: false,
          verified: false,
          error: "SIMULATION_FASTER_THAN_REAL_TIME",
        },
      };
    return processAttemptRecord(
      { manifest: row.manifest, ticket: row.ticket, ...row.record },
      { allowV3: true, verificationTime: receivedAt },
    );
  }
  async read(actor: string, id: string) {
    const row = await this.repository.inspect(actor, id);
    return row.state === "received"
      ? this.verify(actor, row)
      : {
          status: 200,
          body: {
            ok: true,
            ...row.response,
            verified: row.state === "verified",
            durable: true,
            state: row.state,
            match: await this.repository.view(actor, id),
          },
        };
  }
  async recent(actor: string) {
    const rows = await this.repository.recent(actor);
    return Promise.all(
      rows.map(async (row) => ({
        attemptId: row.attempt_id,
        gameId: row.manifest.game_id,
        state: row.state,
        score: row.response?.score,
        height: row.response?.height,
        timeMs: row.response?.time_ms,
        match: await this.repository.view(actor, row.attempt_id),
      })),
    );
  }
  async availability(actor: string, stake: number) {
    return (await this.repository.availability(actor, stake)).filter(
      (r) => getGameDefinition(r.gameId)?.version === r.gameVersion,
    );
  }
}
