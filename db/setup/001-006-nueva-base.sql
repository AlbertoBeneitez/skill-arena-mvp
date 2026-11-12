-- Galactic Games · tablas iniciales para una base nueva (migraciones 001-006).
-- Generado desde db/migrations/; solo crea y añade, nunca borra datos. Se puede repetir sin daño.
BEGIN;

-- ===== 001-matches.sql =====
-- Explicit migration. Never executed automatically by app startup or a build.
-- Store opaque server identity ids only; no emails, names, avatars or demo wallet.
CREATE TABLE IF NOT EXISTS arena_matches (
  match_id text PRIMARY KEY CHECK (length(match_id) BETWEEN 1 AND 128),
  manifest jsonb NOT NULL CHECK (jsonb_typeof(manifest) = 'object'),
  manifest_hash text NOT NULL CHECK (manifest_hash ~ '^sha256:[0-9a-f]{64}$'),
  player_a text NOT NULL CHECK (length(player_a) BETWEEN 1 AND 128),
  player_b text NOT NULL CHECK (length(player_b) BETWEEN 1 AND 128),
  stored_at timestamptz NOT NULL DEFAULT now(),
  CHECK (player_a <> player_b),
  CHECK (manifest ? 'match_id' AND manifest ->> 'match_id' = match_id),
  CHECK (manifest ? 'manifest_version' AND manifest ->> 'manifest_version' IN ('2', '3'))
);

CREATE OR REPLACE FUNCTION arena_prevent_match_rewrite()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'IMMUTABLE_MATCH' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS arena_match_immutable ON arena_matches;
CREATE TRIGGER arena_match_immutable BEFORE UPDATE ON arena_matches
FOR EACH ROW EXECUTE FUNCTION arena_prevent_match_rewrite();

-- ===== 002-command-attempts.sql =====
-- Explicit, additive PostgreSQL migration. Never applied during startup/build.
CREATE TABLE IF NOT EXISTS arena_command_attempts (
 attempt_id text PRIMARY KEY CHECK(length(attempt_id) BETWEEN 1 AND 128),
 match_id text NOT NULL REFERENCES arena_matches(match_id) ON DELETE CASCADE,
 player_id text NOT NULL CHECK(length(player_id) BETWEEN 1 AND 128),
 manifest_hash text NOT NULL CHECK(manifest_hash ~ '^sha256:[0-9a-f]{64}$'),
 revision integer NOT NULL DEFAULT 0 CHECK(revision BETWEEN 0 AND 1000),
 inputs jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(inputs)='array'),
 commands jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(commands)='array'),
 terminal boolean NOT NULL DEFAULT false,
 UNIQUE(match_id,player_id),
 CHECK(jsonb_array_length(inputs)=revision AND jsonb_array_length(commands)=revision)
);

-- ===== 003-public-attempts.sql =====
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

-- ===== 004-studio-proposals.sql =====
-- Explicit, additive PostgreSQL migration (v135). Never applied during startup/build.
-- Game proposals sent by external studios from the app. Personal data kept to the minimum needed to review the
-- proposal and answer it (studio name and a contact e-mail); the owner deletes each proposal once it is answered.
CREATE TABLE IF NOT EXISTS studio_game_proposals (
 proposal_id uuid PRIMARY KEY,
 created_at timestamptz NOT NULL DEFAULT now(),
 studio text NOT NULL CHECK(char_length(studio) BETWEEN 2 AND 80),
 contact text NOT NULL CHECK(char_length(contact) BETWEEN 6 AND 120),
 game text NOT NULL CHECK(char_length(game) BETWEEN 2 AND 60),
 shelf text NOT NULL CHECK(shelf IN ('casino','bar','mythic','dynamic','alternative')),
 summary text NOT NULL CHECK(char_length(summary) BETWEEN 10 AND 280),
 link text NOT NULL CHECK(link LIKE 'https://%' AND char_length(link) <= 300),
 consent_version text NOT NULL
);
CREATE INDEX IF NOT EXISTS studio_game_proposals_created ON studio_game_proposals(created_at DESC);

-- ===== 005-studio-packages.sql =====
-- Explicit, additive PostgreSQL migration (v142). Never applied during startup/build. Requires 004.
-- Studios now send the game itself: one package file (galactic.json, game.html, core.wasm, cover) that passed the
-- automatic admission check at upload. The row keeps the package, its digest, the manifest, the check report, the
-- versions of the conditions and the privacy notice accepted, and the owner's review status.
ALTER TABLE studio_game_proposals ALTER COLUMN link DROP NOT NULL;
ALTER TABLE studio_game_proposals ADD COLUMN IF NOT EXISTS package bytea CHECK (package IS NULL OR octet_length(package) <= 4194304);
ALTER TABLE studio_game_proposals ADD COLUMN IF NOT EXISTS package_sha256 text CHECK (package_sha256 IS NULL OR package_sha256 ~ '^[0-9a-f]{64}$');
ALTER TABLE studio_game_proposals ADD COLUMN IF NOT EXISTS manifest jsonb;
ALTER TABLE studio_game_proposals ADD COLUMN IF NOT EXISTS report jsonb;
ALTER TABLE studio_game_proposals ADD COLUMN IF NOT EXISTS terms_version text;
ALTER TABLE studio_game_proposals ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'received'
  CHECK (review_status IN ('received', 'approved', 'rejected'));
ALTER TABLE studio_game_proposals ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

-- ===== 006-platform-pools.sql =====
-- v179 · Explicit forward migration (additive): public matches belong to one platform, so phones are paired only
-- with phones and computers only with computers. Every existing match was played on the phone-only app: 'mobile'.
ALTER TABLE arena_public_matches ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'mobile';
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='arena_public_matches_platform_check') THEN
  ALTER TABLE arena_public_matches ADD CONSTRAINT arena_public_matches_platform_check CHECK(platform IN ('mobile','desktop'));
 END IF;
END $$;
CREATE INDEX IF NOT EXISTS arena_public_open_by_platform ON arena_public_matches(platform) WHERE resolution IS NULL;

COMMIT;
