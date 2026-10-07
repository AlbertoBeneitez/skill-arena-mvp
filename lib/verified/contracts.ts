import type { GameId } from "@/lib/games";
import type { ReplayInput } from "./inputValidation";

export type MatchManifest = {
  manifest_version: 2;
  match_id: string;
  game_id: GameId;
  game_version: string;
  engine_version: string;
  rules_hash: string;
  gameplay_content_hash: string;
  seed: string;
  simulation: {
    tick_rate: number;
    coordinate_width: number;
    coordinate_height: number;
    end_condition: string;
  };
  competition: {
    players: 2;
    attempts_per_player: 1;
    stake_minor: number;
    currency: "EUR";
    tie_rule: "EXACT_TIE_REFUND";
    target_score: number;
  };
  input_protocol: {
    version: number;
    allowed_actions: string[];
    max_inputs: number;
  };
  created_at: string;
};

export type AttemptTicket = {
  attempt_id: string;
  match_id: string;
  player_id: string;
  slot: "A" | "B";
  manifest_hash: string;
  issued_at: string;
  expires_at: string;
  nonce: string;
  signature: string;
  security_mode: "demo" | "production";
};

export type VerifiedAttemptPayload<
  TInput extends ReplayInput = ReplayInput,
> = {
  manifest: MatchManifest;
  ticket: AttemptTicket;
  inputs: TInput[];
  final_tick: number;
};

export type VerifiedAttemptResult = {
  ok: boolean;
  verified: boolean;
  error?: string;
  verification_id?: string;
  replay_hash?: string;
  score?: number;
  time_ms?: number;
  height?: number;
  failure?: string | null;
  won?: boolean;
  authoritative_source?: "SERVER_REPLAY";
  client_score_ignored?: true;
};
