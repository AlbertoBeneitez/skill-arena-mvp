import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import type { GameId } from "@/lib/games";
import { canonicalJson } from "@/lib/verified/canonical";
import type {
  AttemptTicket,
  MatchManifest,
} from "@/lib/verified/contracts";
import { getServerGameAdapter } from "./gameVerifiers";

const DEMO_SIGNING_SECRET =
  "skill-arena-demo-verification-key-not-for-production";

const ALLOWED_STAKES_MINOR = new Set([0, 100, 500, 1000, 5000]);

const COMMON_COMPETITION_RULES = {
  players: 2,
  attemptsPerPlayer: 1,
  tieRule: "EXACT_TIE_REFUND",
  authoritativeResult: "SERVER_REPLAY_ONLY",
} as const;

export function isAllowedStakeMinor(value: number) {
  return Number.isInteger(value) && ALLOWED_STAKES_MINOR.has(value);
}

function sha256(value: string) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function signingSecret() {
  const configured = process.env.MATCH_SIGNING_SECRET;
  return {
    value: configured || DEMO_SIGNING_SECRET,
    mode: configured ? ("production" as const) : ("demo" as const),
  };
}

export function hashManifest(manifest: MatchManifest) {
  return sha256(canonicalJson(manifest));
}

export function expectedGameplayContentHash(gameId: string) {
  const adapter = getServerGameAdapter(gameId);
  if (!adapter) return null;
  return sha256(canonicalJson(adapter.gameplayContentDescriptor));
}

export function expectedRulesHash(gameId: string) {
  const adapter = getServerGameAdapter(gameId);
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
  matchId?: string;
  stakeMinor?: number;
  targetScore?: number;
  seed?: string;
}): MatchManifest {
  const adapter = getServerGameAdapter(args.gameId);
  if (!adapter) {
    throw new Error("UNSUPPORTED_GAME_VERSION");
  }

  const createdAt = new Date().toISOString();
  const stakeMinor = Math.max(0, Math.floor(args.stakeMinor ?? 0));
  const targetScore = Math.max(1, Math.floor(args.targetScore ?? 1));

  const rulesHash = expectedRulesHash(args.gameId);
  const contentHash = expectedGameplayContentHash(args.gameId);
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
  return createHmac("sha256", signingSecret().value)
    .update(canonicalJson(ticket))
    .digest("base64url");
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
  const { signature, ...unsigned } = ticket;

  if (!signature || typeof signature !== "string") {
    return { ok: false as const, error: "INVALID_TICKET" };
  }

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

export function validateManifest(manifest: MatchManifest) {
  if (
    !manifest ||
    manifest.manifest_version !== 2 ||
    typeof manifest.game_id !== "string"
  ) {
    return { ok: false as const, error: "INVALID_MANIFEST" };
  }

  const adapter = getServerGameAdapter(manifest.game_id);
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
    !manifest.seed ||
    typeof manifest.seed !== "string" ||
    manifest.seed.length > 128
  ) {
    return { ok: false as const, error: "INVALID_MANIFEST" };
  }

  if (
    manifest.gameplay_content_hash !==
      expectedGameplayContentHash(manifest.game_id) ||
    manifest.rules_hash !== expectedRulesHash(manifest.game_id)
  ) {
    return { ok: false as const, error: "INVALID_MANIFEST" };
  }

  if (
    manifest.simulation.tick_rate !== adapter.simulation.tickRate ||
    manifest.simulation.coordinate_width !==
      adapter.simulation.coordinateWidth ||
    manifest.simulation.coordinate_height !==
      adapter.simulation.coordinateHeight ||
    manifest.simulation.end_condition !==
      adapter.simulation.endCondition
  ) {
    return { ok: false as const, error: "INVALID_MANIFEST" };
  }

  const protocol = manifest.input_protocol;
  if (
    protocol.version !== adapter.inputProtocol.version ||
    protocol.max_inputs !== adapter.inputProtocol.maxInputs ||
    protocol.allowed_actions.length !==
      adapter.inputProtocol.allowedActions.length ||
    protocol.allowed_actions.some(
      (action, index) =>
        action !== adapter.inputProtocol.allowedActions[index]
    )
  ) {
    return { ok: false as const, error: "INVALID_MANIFEST" };
  }

  if (
    manifest.competition.players !== 2 ||
    manifest.competition.attempts_per_player !== 1 ||
    manifest.competition.currency !== "EUR" ||
    manifest.competition.tie_rule !== "EXACT_TIE_REFUND" ||
    !isAllowedStakeMinor(manifest.competition.stake_minor) ||
    !Number.isInteger(manifest.competition.target_score) ||
    manifest.competition.target_score < 1 ||
    manifest.competition.target_score > 1_000_000_000
  ) {
    return { ok: false as const, error: "INVALID_MANIFEST" };
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
