import type { TowerDropInput } from "./towerDropCore.v1";

export type MatchManifest = {
  manifest_version: 1;
  match_id: string;
  game_id: "tower-drop";
  game_version: "1.0.0";
  engine_version: "skill-core-1";
  rules_hash: string;
  gameplay_content_hash: string;
  simulation: {
    tick_rate: 120;
    coordinate_width: 390;
    coordinate_height: 620;
    end_condition: "FIRST_FAILURE";
  };
  competition: {
    players: 2;
    attempts_per_player: 1;
    stake_minor: number;
    currency: "EUR";
    tie_rule: "EXACT_TIE_REFUND";
  };
  input_protocol: {
    version: 1;
    allowed_actions: ["DROP"];
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

export type VerifiedAttemptPayload = {
  manifest: MatchManifest;
  ticket: AttemptTicket;
  inputs: TowerDropInput[];
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
  failure?: "NO_OVERLAP" | "TIMEOUT_BOUNCES" | null;
};
