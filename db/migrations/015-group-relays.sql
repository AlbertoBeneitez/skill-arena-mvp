-- v211 · Group relay ("juego grupal"). Additive only. The members of a group build ONE Stack tower together, a turn
-- each: every turn continues the same run (same seed, all earlier drops) and is verified by replaying the whole log
-- (lib/verified/stackRelay.v1.ts). Only one member can hold the turn at a time: the lock has a wall-clock lease, and a
-- turn is accepted only from its holder, within the lease (plus a short grace) and no faster than real time.
CREATE TABLE IF NOT EXISTS arena_group_relays (
  relay_id         uuid PRIMARY KEY,
  group_id         uuid NOT NULL REFERENCES arena_groups(group_id),
  rules_version    text NOT NULL CHECK (rules_version = 'stack-relay-v1'),
  game_id          text NOT NULL CHECK (game_id = 'precision-stack'),
  game_version     text NOT NULL,
  seed             text NOT NULL,
  blocks_per_turn  integer NOT NULL CHECK (blocks_per_turn IN (3, 5, 10)),
  created_by       uuid NOT NULL REFERENCES arena_accounts(account_id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  status           text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'finished', 'cancelled')),
  -- The committed run: every accepted drop, the tick the last accepted turn closed at, and the tower so far.
  inputs           jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(inputs) = 'array'),
  final_tick       integer NOT NULL DEFAULT 0 CHECK (final_tick >= 0),
  height           integer NOT NULL DEFAULT 0 CHECK (height >= 0),
  score            bigint NOT NULL DEFAULT 0 CHECK (score >= 0),
  turns            integer NOT NULL DEFAULT 0 CHECK (turns >= 0),
  failure          text,
  -- The turn in progress (one player at a time).
  lock_account     uuid REFERENCES arena_accounts(account_id),
  lock_turn        integer,
  lock_started_at  timestamptz,
  lock_until       timestamptz,
  finished_at      timestamptz,
  CHECK ((lock_account IS NULL) = (lock_started_at IS NULL) AND (lock_account IS NULL) = (lock_until IS NULL) AND (lock_account IS NULL) = (lock_turn IS NULL))
);
-- At most one relay in play per group.
CREATE UNIQUE INDEX IF NOT EXISTS arena_group_relays_one_open ON arena_group_relays(group_id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS arena_group_relays_group ON arena_group_relays(group_id, created_at DESC);

-- Accepted turns (the audit trail of who placed what).
CREATE TABLE IF NOT EXISTS arena_group_relay_turns (
  relay_id     uuid NOT NULL REFERENCES arena_group_relays(relay_id),
  turn_no      integer NOT NULL CHECK (turn_no >= 1),
  account_id   uuid NOT NULL REFERENCES arena_accounts(account_id),
  started_at   timestamptz NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  inputs       jsonb NOT NULL CHECK (jsonb_typeof(inputs) = 'array'),
  from_tick    integer NOT NULL,
  final_tick   integer NOT NULL,
  placed       integer NOT NULL CHECK (placed >= 0),
  ended        boolean NOT NULL,
  PRIMARY KEY (relay_id, turn_no)
);

-- Turns that did not count (lease expired, someone else had the turn, played faster than real time, invalid replay),
-- kept so the player who arrived later can be told why and the owner can audit conflicts.
CREATE TABLE IF NOT EXISTS arena_group_relay_rejections (
  relay_id    uuid NOT NULL REFERENCES arena_group_relays(relay_id),
  account_id  uuid NOT NULL REFERENCES arena_accounts(account_id),
  at          timestamptz NOT NULL DEFAULT now(),
  reason      text NOT NULL,
  holder      uuid REFERENCES arena_accounts(account_id)
);
CREATE INDEX IF NOT EXISTS arena_group_relay_rejections_account ON arena_group_relay_rejections(account_id, at DESC);
