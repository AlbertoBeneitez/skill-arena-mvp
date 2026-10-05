import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { canonicalJson } from "@/lib/verified/canonical";
import type {
  AttemptTicket,
  MatchManifest,
} from "@/lib/verified/contracts";
import {
  TOWER_DROP_V1,
  TOWER_DROP_V1_CONTENT,
} from "@/lib/verified/towerDropCore.v1";

const DEMO_SIGNING_SECRET =
  "skill-arena-demo-verification-key-not-for-production";

const RULES_V1 = {
  players: 2,
  attemptsPerPlayer: 1,
  endCondition: "FIRST_FAILURE",
  tieRule: "EXACT_TIE_REFUND",
  authoritativeResult: "SERVER_REPLAY_ONLY",
  inputClock: "SIMULATION_TICKS",
} as const;

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

export function expectedTowerDropContentHash() {
  return sha256(canonicalJson(TOWER_DROP_V1_CONTENT));
}

export function expectedRulesHash() {
  return sha256(canonicalJson(RULES_V1));
}

export function createTowerDropManifest(args?: {
  matchId?: string;
  stakeMinor?: number;
}): MatchManifest {
  const createdAt = new Date().toISOString();
  const stakeMinor = Math.max(0, Math.floor(args?.stakeMinor ?? 0));

  return {
    manifest_version: 1,
    match_id: args?.matchId ?? randomUUID(),
    game_id: "tower-drop",
    game_version: TOWER_DROP_V1.gameVersion,
    engine_version: TOWER_DROP_V1.engineVersion,
    rules_hash: expectedRulesHash(),
    gameplay_content_hash: expectedTowerDropContentHash(),
    simulation: {
      tick_rate: TOWER_DROP_V1.tickRate,
      coordinate_width: TOWER_DROP_V1.widthMilli / 1000,
      coordinate_height: 620,
      end_condition: "FIRST_FAILURE",
    },
    competition: {
      players: 2,
      attempts_per_player: 1,
      stake_minor: stakeMinor,
      currency: "EUR",
      tie_rule: "EXACT_TIE_REFUND",
    },
    input_protocol: {
      version: TOWER_DROP_V1.inputProtocolVersion,
      allowed_actions: ["DROP"],
    },
    created_at: createdAt,
  };
}

type UnsignedTicket = Omit<AttemptTicket, "signature">;

function ticketSignature(ticket: UnsignedTicket) {
  const secret = signingSecret().value;
  return createHmac("sha256", secret)
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
  const {
    signature,
    ...unsigned
  } = ticket;

  if (!signature || typeof signature !== "string") {
    return { ok: false as const, error: "MISSING_SIGNATURE" };
  }

  const expected = ticketSignature(unsigned);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return { ok: false as const, error: "INVALID_TICKET_SIGNATURE" };
  }

  if (ticket.match_id !== manifest.match_id) {
    return { ok: false as const, error: "MATCH_ID_MISMATCH" };
  }

  if (ticket.manifest_hash !== hashManifest(manifest)) {
    return { ok: false as const, error: "MANIFEST_HASH_MISMATCH" };
  }

  const expiresAt = Date.parse(ticket.expires_at);
  const issuedAt = Date.parse(ticket.issued_at);
  if (!Number.isFinite(expiresAt) || !Number.isFinite(issuedAt)) {
    return { ok: false as const, error: "INVALID_TICKET_TIME" };
  }

  if (Date.now() > expiresAt) {
    return { ok: false as const, error: "ATTEMPT_TICKET_EXPIRED" };
  }

  return {
    ok: true as const,
    issuedAt,
    expiresAt,
  };
}

export function validateManifest(manifest: MatchManifest) {
  if (
    manifest.manifest_version !== 1 ||
    manifest.game_id !== "tower-drop" ||
    manifest.game_version !== TOWER_DROP_V1.gameVersion ||
    manifest.engine_version !== TOWER_DROP_V1.engineVersion
  ) {
    return { ok: false as const, error: "UNSUPPORTED_GAME_VERSION" };
  }

  if (manifest.gameplay_content_hash !== expectedTowerDropContentHash()) {
    return { ok: false as const, error: "CONTENT_HASH_MISMATCH" };
  }

  if (manifest.rules_hash !== expectedRulesHash()) {
    return { ok: false as const, error: "RULES_HASH_MISMATCH" };
  }

  if (
    manifest.simulation.tick_rate !== TOWER_DROP_V1.tickRate ||
    manifest.simulation.coordinate_width !==
      TOWER_DROP_V1.widthMilli / 1000 ||
    manifest.simulation.coordinate_height !== 620 ||
    manifest.simulation.end_condition !== "FIRST_FAILURE"
  ) {
    return { ok: false as const, error: "SIMULATION_CONFIG_MISMATCH" };
  }

  if (
    manifest.input_protocol.version !==
      TOWER_DROP_V1.inputProtocolVersion ||
    manifest.input_protocol.allowed_actions.length !== 1 ||
    manifest.input_protocol.allowed_actions[0] !== "DROP"
  ) {
    return { ok: false as const, error: "INPUT_PROTOCOL_MISMATCH" };
  }

  return { ok: true as const };
}

export function hashReplay(args: {
  manifestHash: string;
  attemptId: string;
  inputs: unknown;
  finalTick: number;
  score: number;
  height: number;
  failure: unknown;
}) {
  return sha256(canonicalJson(args));
}
