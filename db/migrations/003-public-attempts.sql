-- Explicit forward migration; no startup/build migrations or production activation.
-- Existing assigned participants and all historical manifests remain immutable.
ALTER TABLE arena_matches ALTER COLUMN player_b DROP NOT NULL;
CREATE OR REPLACE FUNCTION arena_prevent_match_rewrite()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW IS DISTINCT FROM OLD AND NOT (
  OLD.player_b IS NULL AND NEW.player_b IS NOT NULL
  AND (to_jsonb(NEW)-'player_b') = (to_jsonb(OLD)-'player_b')
 ) THEN RAISE EXCEPTION 'IMMUTABLE_MATCH' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END;
$$;
CREATE TABLE IF NOT EXISTS arena_public_matches (
 match_id text PRIMARY KEY REFERENCES arena_matches(match_id) ON DELETE CASCADE,
 policy_version text NOT NULL CHECK(policy_version='forfeit-on-disconnect-v1'),
 scope text NOT NULL CHECK(scope='training'),
 expires_at timestamptz NOT NULL,
 resolution jsonb
);
CREATE TABLE IF NOT EXISTS arena_scenario_rotation (
 game_id text NOT NULL, game_version text NOT NULL, cursor bigint NOT NULL CHECK(cursor>=0),
 PRIMARY KEY(game_id,game_version)
);
CREATE TABLE IF NOT EXISTS arena_public_attempts (
 attempt_id text PRIMARY KEY,
 match_id text NOT NULL REFERENCES arena_public_matches(match_id) ON DELETE CASCADE,
 player_id text NOT NULL, slot text NOT NULL CHECK(slot IN ('A','B')),
 start_key text NOT NULL, request_hash text NOT NULL,
 ticket jsonb NOT NULL CHECK(jsonb_typeof(ticket)='object'),
 state text NOT NULL CHECK(state IN ('playing','received','verified','rejected','forfeited')),
 started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 lease_until timestamptz NOT NULL, deadline timestamptz NOT NULL,
 record jsonb, record_hash text, record_received_at timestamptz, response jsonb, replay_audit jsonb,
 processing_token text, processing_until timestamptz,
 UNIQUE(player_id,start_key), UNIQUE(match_id,slot), UNIQUE(match_id,player_id),
 CHECK((record IS NULL)=(record_hash IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS arena_public_one_running
 ON arena_public_attempts(player_id) WHERE state='playing';
CREATE INDEX IF NOT EXISTS arena_public_expiry ON arena_public_attempts(lease_until) WHERE state='playing';
CREATE INDEX IF NOT EXISTS arena_public_actor_history ON arena_public_attempts(player_id,started_at);
CREATE OR REPLACE FUNCTION arena_public_record_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.attempt_id<>OLD.attempt_id OR NEW.match_id<>OLD.match_id OR NEW.player_id<>OLD.player_id
 OR NEW.slot<>OLD.slot OR NEW.ticket<>OLD.ticket OR NEW.start_key<>OLD.start_key
 OR NEW.request_hash<>OLD.request_hash OR NEW.started_at<>OLD.started_at OR NEW.deadline<>OLD.deadline
 OR (OLD.record IS NOT NULL AND (NEW.record IS DISTINCT FROM OLD.record OR NEW.record_hash IS DISTINCT FROM OLD.record_hash OR NEW.record_received_at IS DISTINCT FROM OLD.record_received_at))
 OR (OLD.response IS NOT NULL AND NEW.response IS DISTINCT FROM OLD.response)
 OR (OLD.state IN ('verified','rejected','forfeited') AND NEW.state<>OLD.state)
 THEN RAISE EXCEPTION 'IMMUTABLE_ATTEMPT' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS arena_public_immutable ON arena_public_attempts;
CREATE TRIGGER arena_public_immutable BEFORE UPDATE ON arena_public_attempts FOR EACH ROW EXECUTE FUNCTION arena_public_record_immutable();
CREATE OR REPLACE FUNCTION arena_public_match_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.match_id<>OLD.match_id OR NEW.policy_version<>OLD.policy_version OR NEW.scope<>OLD.scope
 OR NEW.expires_at<>OLD.expires_at OR (OLD.resolution IS NOT NULL AND NEW.resolution IS DISTINCT FROM OLD.resolution)
 THEN RAISE EXCEPTION 'IMMUTABLE_RESOLUTION' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS arena_public_match_guard ON arena_public_matches;
CREATE TRIGGER arena_public_match_guard BEFORE UPDATE ON arena_public_matches FOR EACH ROW EXECUTE FUNCTION arena_public_match_immutable();
