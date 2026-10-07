import type { GameId } from "@/lib/games";
import type { ReplayInput } from "./inputValidation";

type MatchManifestFields = {
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

/** Historical wire format. Never add scenario fields to a signed V2 manifest. */
export type MatchManifestV2 = MatchManifestFields & {
  manifest_version: 2;
};

/** Generator revisions and scenario identities are immutable once issued. */
export type ScenarioDescriptor = {
  scenario_id: string;
  generator_version: string;
};

export type MatchManifestV3 = MatchManifestFields & {
  manifest_version: 3;
  scenario: ScenarioDescriptor;
};

export type MatchManifest = MatchManifestV2 | MatchManifestV3;

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
