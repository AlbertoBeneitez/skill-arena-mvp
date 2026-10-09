import {
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import type { GameId } from "@/lib/games";
import { canonicalJson } from "@/lib/verified/canonical";
import type {
  AttemptTicket,
  AttemptRecordResponse,
  MatchManifest,
  MatchManifestV2,
  VerifiedAttemptPayload,
} from "@/lib/verified/contracts";
import {
  validateInputSequence,
  type ReplayInput,
} from "@/lib/verified/inputValidation";
import { getServerGameAdapter } from "./gameVerifiers";
import { hashManifest, sha256, signAttemptTicket } from "./matchIntegrity";
import { resolveScenario, isPrivateScenario } from "./scenarios";

export { hashManifest } from "./matchIntegrity";

const DEMO_SIGNING_SECRET =
  "skill-arena-demo-verification-key-not-for-production";

const ALLOWED_STAKES_MINOR = new Set([0, 100, 500, 1000, 5000]);

const COMMON_COMPETITION_RULES = {
  players: 2,
  attemptsPerPlayer: 1,
  tieRule: "EXACT_TIE_REFUND",
  authoritativeResult: "SERVER_REPLAY_ONLY",
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isAttemptTicketShape(value: unknown): value is AttemptTicket {
  if (!isRecord(value)) return false;

  return (
    typeof value.attempt_id === "string" &&
    typeof value.match_id === "string" &&
    typeof value.player_id === "string" &&
    (value.slot === "A" || value.slot === "B") &&
    typeof value.manifest_hash === "string" &&
    typeof value.issued_at === "string" &&
    typeof value.expires_at === "string" &&
    typeof value.nonce === "string" &&
    typeof value.signature === "string" &&
    (value.security_mode === "demo" ||
      value.security_mode === "production")
  );
}

export function isAllowedStakeMinor(value: number) {
  return Number.isInteger(value) && ALLOWED_STAKES_MINOR.has(value);
}

function signingSecret() {
  const configured = process.env.MATCH_SIGNING_SECRET;
  return {
    value: configured || DEMO_SIGNING_SECRET,
    mode: configured ? ("production" as const) : ("demo" as const),
  };
}

export function expectedGameplayContentHash(
  gameId: string,
  gameVersion?: string
) {
  const adapter = getServerGameAdapter(gameId, gameVersion);
  if (!adapter) return null;
  return sha256(canonicalJson(adapter.gameplayContentDescriptor));
}

export function expectedRulesHash(
  gameId: string,
  gameVersion?: string
) {
  const adapter = getServerGameAdapter(gameId, gameVersion);
  if (!adapter) return null;

  return sha256(
    canonicalJson({
      common: COMMON_COMPETITION_RULES,
      game: adapter.rulesDescriptor,
    })
  );
}

export function createMatchManifest(args: {
  gameId: GameId;
  gameVersion?: string;
  matchId?: string;
  stakeMinor?: number;
  targetScore?: number;
  seed?: string;
}): MatchManifestV2 {
  const adapter = getServerGameAdapter(args.gameId,args.gameVersion);
  if (!adapter) {
    throw new Error("UNSUPPORTED_GAME_VERSION");
  }

  const createdAt = new Date().toISOString();
  const stakeMinor = Math.max(0, Math.floor(args.stakeMinor ?? 0));
  const targetScore = Math.max(1, Math.floor(args.targetScore ?? 1));

  const rulesHash = expectedRulesHash(
    args.gameId,
    adapter.gameVersion
  );
  const contentHash = expectedGameplayContentHash(
    args.gameId,
    adapter.gameVersion
  );
  if (!rulesHash || !contentHash) {
    throw new Error("UNSUPPORTED_GAME_VERSION");
  }

  return {
    manifest_version: 2,
    match_id: args.matchId ?? randomUUID(),
    game_id: adapter.gameId,
    game_version: adapter.gameVersion,
    engine_version: adapter.engineVersion,
    rules_hash: rulesHash,
    gameplay_content_hash: contentHash,
    seed: args.seed ?? randomBytes(16).toString("hex"),
    simulation: {
      tick_rate: adapter.simulation.tickRate,
      coordinate_width: adapter.simulation.coordinateWidth,
      coordinate_height: adapter.simulation.coordinateHeight,
      end_condition: adapter.simulation.endCondition,
    },
    competition: {
      players: 2,
      attempts_per_player: 1,
      stake_minor: stakeMinor,
      currency: "EUR",
      tie_rule: "EXACT_TIE_REFUND",
      target_score: targetScore,
    },
    input_protocol: {
      version: adapter.inputProtocol.version,
      allowed_actions: [...adapter.inputProtocol.allowedActions],
      max_inputs: adapter.inputProtocol.maxInputs,
    },
    created_at: createdAt,
  };
}

type UnsignedTicket = Omit<AttemptTicket, "signature">;

function ticketSignature(ticket: UnsignedTicket) {
  return signAttemptTicket(ticket, signingSecret().value);
}

export function issueAttemptTicket(args: {
  manifest: MatchManifest;
  playerId: string;
  slot?: "A" | "B";
  ttlMinutes?: number;
}): AttemptTicket {
  const issued = Date.now();
  const ttlMinutes = Math.max(1, Math.min(30, args.ttlMinutes ?? 15));
  const security = signingSecret();

  const unsigned: UnsignedTicket = {
    attempt_id: randomUUID(),
    match_id: args.manifest.match_id,
    player_id: args.playerId,
    slot: args.slot ?? "A",
    manifest_hash: hashManifest(args.manifest),
    issued_at: new Date(issued).toISOString(),
    expires_at: new Date(issued + ttlMinutes * 60_000).toISOString(),
    nonce: randomBytes(18).toString("base64url"),
    security_mode: security.mode,
  };

  return {
    ...unsigned,
    signature: ticketSignature(unsigned),
  };
}

export function verifyAttemptTicket(
  ticket: AttemptTicket,
  manifest: MatchManifest
) {
  if (!isAttemptTicketShape(ticket)) {
    return { ok: false as const, error: "INVALID_TICKET" };
  }

  const { signature, ...unsigned } = ticket;

  const expected = ticketSignature(unsigned);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return { ok: false as const, error: "INVALID_TICKET" };
  }

  if (
    ticket.match_id !== manifest.match_id ||
    ticket.manifest_hash !== hashManifest(manifest)
  ) {
    return { ok: false as const, error: "INVALID_TICKET" };
  }

  const expiresAt = Date.parse(ticket.expires_at);
  const issuedAt = Date.parse(ticket.issued_at);
  if (!Number.isFinite(expiresAt) || !Number.isFinite(issuedAt)) {
    return { ok: false as const, error: "INVALID_TICKET" };
  }

  if (Date.now() > expiresAt) {
    return { ok: false as const, error: "ATTEMPT_EXPIRED" };
  }

  return {
    ok: true as const,
    issuedAt,
    expiresAt,
  };
}

/** V3 is staged for trusted storage; existing HTTP callers remain V2-only. */
export function validateManifest(
  manifest: MatchManifest,
  options: { allowV3?: boolean; allowPrivateScenario?: boolean } = {}
) {
  if (!isRecord(manifest)) {
    return { ok: false as const, error: "INVALID_MANIFEST" };
  }

  const simulation = manifest.simulation;
  const competition = manifest.competition;
  const inputProtocol = manifest.input_protocol;

  if (
    (manifest.manifest_version !== 2 &&
      !(options.allowV3 === true && manifest.manifest_version === 3)) ||
    typeof manifest.game_id !== "string" ||
    typeof manifest.game_version !== "string" ||
    typeof manifest.engine_version !== "string" ||
    typeof manifest.rules_hash !== "string" ||
    typeof manifest.gameplay_content_hash !== "string" ||
    typeof manifest.seed !== "string" ||
    manifest.seed.length < 1 ||
    manifest.seed.length > 128 ||
    typeof manifest.created_at !== "string" ||
    !isRecord(simulation) ||
    !isRecord(competition) ||
    !isRecord(inputProtocol)
  ) {
    return { ok: false as const, error: "INVALID_MANIFEST" };
  }

  const adapter = getServerGameAdapter(
    manifest.game_id,
    manifest.game_version
  );
  if (!adapter) {
    return { ok: false as const, error: "UNSUPPORTED_GAME_VERSION" };
  }

  if (
    manifest.game_version !== adapter.gameVersion ||
    manifest.engine_version !== adapter.engineVersion
  ) {
    return { ok: false as const, error: "UNSUPPORTED_GAME_VERSION" };
  }

  if (
    manifest.gameplay_content_hash !==
      expectedGameplayContentHash(
        manifest.game_id,
        manifest.game_version
      ) ||
    manifest.rules_hash !==
      expectedRulesHash(
        manifest.game_id,
        manifest.game_version
      )
  ) {
    return { ok: false as const, error: "INVALID_MANIFEST" };
  }

  if (
    simulation.tick_rate !== adapter.simulation.tickRate ||
    simulation.coordinate_width !==
      adapter.simulation.coordinateWidth ||
    simulation.coordinate_height !==
      adapter.simulation.coordinateHeight ||
    simulation.end_condition !==
      adapter.simulation.endCondition
  ) {
    return { ok: false as const, error: "INVALID_MANIFEST" };
  }

  if (
    inputProtocol.version !== adapter.inputProtocol.version ||
    inputProtocol.max_inputs !== adapter.inputProtocol.maxInputs ||
    !Array.isArray(inputProtocol.allowed_actions) ||
    inputProtocol.allowed_actions.length !==
      adapter.inputProtocol.allowedActions.length ||
    inputProtocol.allowed_actions.some(
      (action, index) =>
        action !== adapter.inputProtocol.allowedActions[index]
    )
  ) {
    return { ok: false as const, error: "INVALID_MANIFEST" };
  }

  if (
    competition.players !== 2 ||
    competition.attempts_per_player !== 1 ||
    competition.currency !== "EUR" ||
    competition.tie_rule !== "EXACT_TIE_REFUND" ||
    typeof competition.stake_minor !== "number" ||
    !isAllowedStakeMinor(competition.stake_minor) ||
    !Number.isInteger(competition.target_score) ||
    (competition.target_score as number) < 1 ||
    (competition.target_score as number) > 1_000_000_000
  ) {
    return { ok: false as const, error: "INVALID_MANIFEST" };
  }

  if (!Number.isFinite(Date.parse(manifest.created_at))) {
    return { ok: false as const, error: "INVALID_MANIFEST" };
  }

  if (manifest.manifest_version === 3) {
    if (options.allowPrivateScenario === true && isPrivateScenario(manifest.scenario)) {
      if (!/^[0-9a-f]{64}$/.test(manifest.seed)) return { ok: false as const, error: "INVALID_MANIFEST" };
    } else try {
      const generated = resolveScenario(
        { game_id: manifest.game_id, game_version: manifest.game_version },
        manifest.scenario
      );
      if (generated.seed !== manifest.seed) {
        return { ok: false as const, error: "INVALID_MANIFEST" };
      }
    } catch {
      return { ok: false as const, error: "INVALID_MANIFEST" };
    }
  }

  return { ok: true as const, adapter };
}

export function hashReplay(args: {
  manifestHash: string;
  attemptId: string;
  inputs: unknown;
  finalTick: number;
  result: {
    score: number;
    timeMs: number;
    won: boolean;
    height?: number;
    failure?: string | null;
  };
}) {
  return sha256(canonicalJson(args));
}

/** Shared bounded HTTP semantics. An unfinished receipt never settles a result. */
export function processAttemptRecord(raw: unknown): {
  status: number;
  body: AttemptRecordResponse;
} {
  const reject = (error: string, status = 400) => ({
    status,
    body: { ok: false, verified: false, error },
  });

  if (!isRecord(raw)) return reject("INVALID_PAYLOAD");
  if (
    !raw.manifest || typeof raw.manifest !== "object" ||
    !raw.ticket || typeof raw.ticket !== "object" ||
    !Array.isArray(raw.inputs) || !Number.isInteger(raw.final_tick) ||
    (raw.record_kind !== undefined && raw.record_kind !== "abandoned")
  ) return reject("INVALID_PAYLOAD");

  const payload = raw as unknown as VerifiedAttemptPayload;
  const { manifest, ticket } = payload;
  const inputs = payload.inputs as ReplayInput[];
  const finalTick = payload.final_tick;
  const abandoned = raw.record_kind === "abandoned";

  const manifestCheck = validateManifest(manifest);
  if (!manifestCheck.ok) return reject(manifestCheck.error);
  const ticketCheck = verifyAttemptTicket(ticket, manifest);
  if (!ticketCheck.ok) return reject(ticketCheck.error, 401);

  const adapter = manifestCheck.adapter;
  const inputError = validateInputSequence(inputs, finalTick, {
    version: adapter.inputProtocol.version,
    allowedActions: adapter.inputProtocol.allowedActions,
    maxInputs: adapter.inputProtocol.maxInputs,
    maxFinalTick: adapter.simulation.maxFinalTick,
  });
  if (inputError) return reject(inputError);

  const replay = adapter.replay({ inputs, finalTick, manifest });
  if (abandoned && replay.valid) return reject("TERMINAL_RECORD_REQUIRES_VERIFICATION");
  if (!replay.valid && !(abandoned && replay.error === "CLIENT_ENDED_BEFORE_RESOLUTION")) {
    return reject(replay.error ?? "REPLAY_MISMATCH");
  }

  const elapsedWallMs = Date.now() - ticketCheck.issuedAt;
  const maxClockLeadMs = 2_500;
  if (replay.timeMs > elapsedWallMs + maxClockLeadMs) {
    return reject("SIMULATION_FASTER_THAN_REAL_TIME", 409);
  }

  if (abandoned) return {
    status: 200,
    body: {
      ok: true,
      received: true,
      verified: false,
      durable: false,
      attempt_id: ticket.attempt_id,
      final_tick: finalTick,
    },
  };

  // Preserve the historical terminal hash, result fields and random receipt id.
  const manifestHash = hashManifest(manifest);
  const replayHash = hashReplay({
    manifestHash,
    attemptId: ticket.attempt_id,
    inputs,
    finalTick,
    result: {
      score: replay.score,
      timeMs: replay.timeMs,
      won: replay.won,
      height: replay.height,
      failure: replay.failure,
    },
  });
  return {
    status: 200,
    body: {
      ok: true,
      verified: true,
      verification_id: randomUUID(),
      replay_hash: replayHash,
      score: replay.score,
      time_ms: replay.timeMs,
      height: replay.height,
      failure: replay.failure ?? null,
      won: replay.won,
      authoritative_source: "SERVER_REPLAY",
      client_score_ignored: true,
    },
  };
}
