-- v208 · New public matches are stored under forfeit-on-disconnect-v2 (each game's score in its own direction, then
-- time). Matches already stored under v1 keep it and keep resolving under v1. Only the allowed values change.
DO $$
DECLARE c text;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint
            WHERE conrelid = 'arena_public_matches'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%policy_version%'
  LOOP
    EXECUTE format('ALTER TABLE arena_public_matches DROP CONSTRAINT %I', c);
  END LOOP;
END $$;
ALTER TABLE arena_public_matches ADD CONSTRAINT arena_public_matches_policy_version_check
  CHECK (policy_version IN ('forfeit-on-disconnect-v1', 'forfeit-on-disconnect-v2'));
