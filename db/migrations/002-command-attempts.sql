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
