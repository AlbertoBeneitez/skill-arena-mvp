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
