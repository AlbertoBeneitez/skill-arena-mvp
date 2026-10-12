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
import {
  getGameRules,
  requireGameRules,
} from "@/lib/game-rules/rulesRegistry";
import {
  getGameScenario,
  manifestScenarioFor,
  selectGameScenario,
} from "@/lib/game-scenarios/scenarioRegistry";
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

const ATTEMPT_TTL_MINUTES = 15;
export const MAX_CLOCK_LEAD_MS = 2_500;

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

export function expectedGameplayContentHash(
  gameId: string,
  gameVersion?: string,
  scenarioId?: string
) {
  const adapter = getServerGameAdapter(gameId, gameVersion);
  if (!adapter) return null;
  const scenario = scenarioId
    ? getGameScenario(
        adapter.gameId,
        adapter.gameVersion,
        scenarioId
      )
    : undefined;

  if (scenarioId && !scenario) return null;

  return sha256(
    canonicalJson({
      game: adapter.gameplayContentDescriptor,
      scenario: scenario?.descriptor ?? null,
    })
  );
}

export function expectedRulesHash(
  gameId: string,
  gameVersion?: string
) {
  const adapter = getServerGameAdapter(gameId, gameVersion);
  if (!adapter) return null;
  const rules = getGameRules(adapter.gameId, adapter.gameVersion);
  if (!rules) return null;

  return sha256(
    canonicalJson({
      common: COMMON_COMPETITION_RULES,
      official: rules,
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
  scenarioId?: string;
}): MatchManifest {
  const adapter = getServerGameAdapter(args.gameId);
  if (!adapter) {
    throw new Error("UNSUPPORTED_GAME_VERSION");
  }

  const createdAt = new Date().toISOString();
  const stakeMinor = Math.max(0, Math.floor(args.stakeMinor ?? 0));
  const targetScore = Math.max(1, Math.floor(args.targetScore ?? 1));
  const seed = args.seed ?? randomBytes(16).toString("hex");
  const rules = requireGameRules(adapter.gameId, adapter.gameVersion);
  const scenario = selectGameScenario(
    adapter.gameId,
    adapter.gameVersion,
    seed,
    args.scenarioId
  );

  if (!scenario) {
    throw new Error("UNSUPPORTED_GAME_SCENARIO");
  }

  const rulesHash = expectedRulesHash(
    args.gameId,
    adapter.gameVersion
  );
  const contentHash = expectedGameplayContentHash(
    args.gameId,
    adapter.gameVersion,
    scenario.scenarioId
  );
  if (!rulesHash || !contentHash) {
    throw new Error("UNSUPPORTED_GAME_VERSION");
  }

  return {
    manifest_version: 3,
    match_id: args.matchId ?? randomUUID(),
    game_id: adapter.gameId,
    game_version: adapter.gameVersion,
    engine_version: adapter.engineVersion,
    rules_version: rules.rulesVersion,
    rules_hash: rulesHash,
    scenario: manifestScenarioFor(scenario),
    gameplay_content_hash: contentHash,
    seed,
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
    lifecycle: {
      attempt_ttl_ms: ATTEMPT_TTL_MINUTES * 60_000,
      input_capture: "ORDERED_TICK_INPUT_STREAM",
      duplicate_submission_policy:
        "FIRST_TERMINAL_SUBMISSION_WINS",
      disconnect_policy: "ATTEMPT_ABANDONED_IF_NOT_VERIFIED",
      replay_storage: "SERVER_AUDIT_LEDGER",
      max_clock_lead_ms: MAX_CLOCK_LEAD_MS,
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
  const ttlMinutes = Math.max(
    1,
    Math.min(30, args.ttlMinutes ?? ATTEMPT_TTL_MINUTES)
  );
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

export function validateManifest(manifest: MatchManifest) {
  if (!isRecord(manifest)) {
    return { ok: false as const, error: "INVALID_MANIFEST" };
  }

  const simulation = manifest.simulation;
  const competition = manifest.competition;
  const inputProtocol = manifest.input_protocol;
  const lifecycle = manifest.lifecycle;

  if (
    manifest.manifest_version !== 3 ||
    typeof manifest.game_id !== "string" ||
    typeof manifest.game_version !== "string" ||
    typeof manifest.engine_version !== "string" ||
    typeof manifest.rules_version !== "string" ||
    typeof manifest.rules_hash !== "string" ||
    typeof manifest.gameplay_content_hash !== "string" ||
    typeof manifest.seed !== "string" ||
    manifest.seed.length < 1 ||
    manifest.seed.length > 128 ||
    typeof manifest.created_at !== "string" ||
    !isRecord(simulation) ||
    !isRecord(competition) ||
    !isRecord(inputProtocol) ||
    !isRecord(lifecycle) ||
    !isRecord(manifest.scenario)
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

  const expectedRules = getGameRules(
    manifest.game_id,
    manifest.game_version
  );
  const expectedScenario = getGameScenario(
    manifest.game_id,
    manifest.game_version,
    manifest.scenario.id
  );
  if (!expectedRules || !expectedScenario) {
    return { ok: false as const, error: "INVALID_MANIFEST" };
  }

  if (
    manifest.rules_version !== expectedRules.rulesVersion ||
    manifest.scenario.version !==
      expectedScenario.scenarioVersion ||
    manifest.scenario.difficulty !==
      expectedScenario.difficulty ||
    manifest.scenario.seed_namespace !==
      expectedScenario.seedNamespace ||
    manifest.scenario.generation !== expectedScenario.generation
  ) {
    return { ok: false as const, error: "INVALID_MANIFEST" };
  }

  if (
    manifest.gameplay_content_hash !==
      expectedGameplayContentHash(
        manifest.game_id,
        manifest.game_version,
        manifest.scenario.id
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

  if (
    lifecycle.attempt_ttl_ms !== ATTEMPT_TTL_MINUTES * 60_000 ||
    lifecycle.input_capture !== "ORDERED_TICK_INPUT_STREAM" ||
    lifecycle.duplicate_submission_policy !==
      "FIRST_TERMINAL_SUBMISSION_WINS" ||
    lifecycle.disconnect_policy !==
      "ATTEMPT_ABANDONED_IF_NOT_VERIFIED" ||
    lifecycle.replay_storage !== "SERVER_AUDIT_LEDGER" ||
    lifecycle.max_clock_lead_ms !== MAX_CLOCK_LEAD_MS
  ) {
    return { ok: false as const, error: "INVALID_MANIFEST" };
  }

  if (!Number.isFinite(Date.parse(manifest.created_at))) {
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
