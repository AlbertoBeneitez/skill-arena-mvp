import type {
  AttemptTicket,
  MatchManifest,
} from "@/lib/verified/contracts";
import type { ReplayInput } from "@/lib/verified/inputValidation";

type MatchAuditRecord = {
  matchId: string;
  manifestHash: string;
  manifest: MatchManifest;
  issuedTicketIds: string[];
  requestKey: string;
  createdAt: string;
};

type AttemptAuditRecord = {
  auditId: string;
  attemptId: string;
  matchId: string;
  playerId: string;
  slot: "A" | "B";
  manifestHash: string;
  accepted: boolean;
  error?: string;
  inputs: ReplayInput[];
  finalTick: number;
  receivedAt: string;
  replayHash?: string;
  result?: {
    score: number;
    timeMs: number;
    won: boolean;
    height?: number;
    failure?: string | null;
  };
};

type AttemptAuditLedger = {
  matches: Map<string, MatchAuditRecord>;
  attempts: Map<string, AttemptAuditRecord>;
  closedAttemptIds: Set<string>;
};

declare global {
  // eslint-disable-next-line no-var
  var __skillArenaAttemptAuditLedger:
    | AttemptAuditLedger
    | undefined;
}

const MAX_MATCH_RECORDS = 1_000;
const MAX_ATTEMPT_RECORDS = 2_000;

function ledger() {
  globalThis.__skillArenaAttemptAuditLedger ??= {
    matches: new Map(),
    attempts: new Map(),
    closedAttemptIds: new Set(),
  };

  return globalThis.__skillArenaAttemptAuditLedger;
}

function pruneMap<K, V>(map: Map<K, V>, maxSize: number) {
  while (map.size > maxSize) {
    const firstKey = map.keys().next().value as K | undefined;
    if (firstKey === undefined) return;
    map.delete(firstKey);
  }
}

export function recordMatchStart(args: {
  manifest: MatchManifest;
  manifestHash: string;
  ticket: AttemptTicket;
  requestKey: string;
}) {
  const store = ledger();
  const existing = store.matches.get(args.manifest.match_id);

  store.matches.set(args.manifest.match_id, {
    matchId: args.manifest.match_id,
    manifestHash: args.manifestHash,
    manifest: args.manifest,
    issuedTicketIds: existing
      ? [...existing.issuedTicketIds, args.ticket.attempt_id]
      : [args.ticket.attempt_id],
    requestKey: args.requestKey,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  });

  pruneMap(store.matches, MAX_MATCH_RECORDS);
}

export function reserveAttemptSubmission(attemptId: string) {
  const store = ledger();
  if (store.closedAttemptIds.has(attemptId)) return false;
  store.closedAttemptIds.add(attemptId);
  return true;
}

export function recordAttemptSubmission(args: AttemptAuditRecord) {
  const store = ledger();
  store.attempts.set(args.attemptId, args);
  pruneMap(store.attempts, MAX_ATTEMPT_RECORDS);
}

export function getAttemptAuditRecord(attemptId: string) {
  return ledger().attempts.get(attemptId);
}
