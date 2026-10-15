import type {
  AttemptTicket,
  MatchManifest,
  VerifiedAttemptResult,
} from "../verified/contracts";
import type { PublicRecord, PublicMatchView } from "../publicMatch";
export type PublicAttempt = {
  request_hash: string;
  attempt_id: string;
  match_id: string;
  player_id: string;
  slot: "A" | "B";
  state: "playing" | "received" | "verified" | "rejected" | "forfeited";
  manifest: MatchManifest;
  ticket: AttemptTicket;
  record: PublicRecord | null;
  record_received_at: Date | null;
  record_hash: string | null;
  replay_audit: unknown;
  response: VerifiedAttemptResult | null;
  processing_token: string | null;
};
export type StartPublicAttempt = {
  actor: string;
  key: string;
  requestHash: string;
  gameId: string;
  gameVersion: string;
  stake: number;
  durationMs: number;
  manifest(index: number): MatchManifest;
  ticket(manifest: MatchManifest, slot: "A" | "B"): AttemptTicket;
};
export interface PublicAttemptRepository {
  inspect(actor: string, id: string): Promise<PublicAttempt>;
  recent(actor: string): Promise<PublicAttempt[]>;
  start(args: StartPublicAttempt): Promise<PublicAttempt>;
  pulse(actor: string, id: string, abandon: boolean): Promise<PublicAttempt>;
  receive(
    actor: string,
    id: string,
    hash: string,
    record: PublicRecord,
  ): Promise<PublicAttempt>;
  claim(actor: string, id: string): Promise<PublicAttempt | null>;
  complete(
    actor: string,
    id: string,
    token: string,
    response: VerifiedAttemptResult,
  ): Promise<PublicAttempt>;
  audit(actor: string, id: string, hash: string, audit: unknown): Promise<void>;
  view(actor: string, id: string): Promise<PublicMatchView>;
  availability(
    actor: string,
    stake: number,
  ): Promise<
    {
      gameId: string;
      gameVersion: string;
      mode: "create" | "existing" | "waiting";
    }[]
  >;
}
export class PublicAttemptError extends Error {
  constructor(
    readonly code: string,
    readonly status = 409,
  ) {
    super(code);
  }
}
