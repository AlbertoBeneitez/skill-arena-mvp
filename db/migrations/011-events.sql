-- v196 · Player measurement. Additive only.
-- 1) arena_consents: every decision about measurement, one row each, never edited or deleted (audit trail).
-- 2) arena_events: what a player did that the verified matches do not already say (screens, games opened, group
--    actions). Written only while the player's latest decision is "granted"; updates are refused; rows are removed only by
--    the retention job (SET LOCAL arena.retention = 'on').
-- 3) arena_event_daily: a summary that can always be rebuilt from arena_events.
-- 4) arena_player_matches: a view over verified attempts, so match behaviour is never copied into a second place.
CREATE TABLE IF NOT EXISTS arena_consents (
  consent_id  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id  uuid NOT NULL REFERENCES arena_accounts(account_id),
  purpose     text NOT NULL CHECK (purpose IN ('analytics')),
  version     text NOT NULL CHECK (length(version) BETWEEN 1 AND 40),
  granted     boolean NOT NULL,
  decided_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS arena_consents_latest ON arena_consents(account_id, purpose, consent_id DESC);

CREATE TABLE IF NOT EXISTS arena_events (
  event_id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at     timestamptz NOT NULL DEFAULT now(),
  account_id      uuid NOT NULL REFERENCES arena_accounts(account_id),
  source          text NOT NULL CHECK (source IN ('server', 'client')),
  kind            text NOT NULL CHECK (kind ~ '^[a-z][a-z_]{2,39}$'),
  schema_version  smallint NOT NULL DEFAULT 1,
  platform        text NOT NULL CHECK (platform IN ('mobile', 'desktop')),
  game_id         text,
  game_version    text,
  consent_version text NOT NULL,
  data            jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(data) = 'object' AND pg_column_size(data) <= 2048)
);
CREATE INDEX IF NOT EXISTS arena_events_time ON arena_events(occurred_at);
CREATE INDEX IF NOT EXISTS arena_events_account ON arena_events(account_id, occurred_at);
CREATE INDEX IF NOT EXISTS arena_events_kind ON arena_events(kind, occurred_at);

CREATE OR REPLACE FUNCTION arena_log_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND TG_TABLE_NAME = 'arena_events' AND current_setting('arena.retention', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = '23514';
END;
$$;
DROP TRIGGER IF EXISTS arena_consents_guard ON arena_consents;
CREATE TRIGGER arena_consents_guard BEFORE UPDATE OR DELETE ON arena_consents FOR EACH ROW EXECUTE FUNCTION arena_log_guard();
DROP TRIGGER IF EXISTS arena_events_guard ON arena_events;
CREATE TRIGGER arena_events_guard BEFORE UPDATE OR DELETE ON arena_events FOR EACH ROW EXECUTE FUNCTION arena_log_guard();

CREATE TABLE IF NOT EXISTS arena_event_daily (
  day      date NOT NULL,
  platform text NOT NULL,
  game_id  text NOT NULL DEFAULT '',
  kind     text NOT NULL,
  events   integer NOT NULL,
  players  integer NOT NULL,
  PRIMARY KEY (day, platform, game_id, kind)
);

CREATE OR REPLACE VIEW arena_player_matches AS
SELECT a.attempt_id, a.account_id, m.game_id, m.game_version, pm.platform, a.state, a.started_at,
       a.record_received_at, (a.response ->> 'score')::double precision AS score,
       a.response ->> 'authoritative_source' AS authoritative_source,
       (a.record ->> 'record_kind') = 'abandoned' AS abandoned
  FROM arena_public_attempts a
  JOIN arena_public_matches pm USING (match_id)
  JOIN arena_matches m USING (match_id)
 WHERE a.account_id IS NOT NULL;
