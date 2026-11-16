-- v193 · Foundation 1 and 3. Additive only.
-- 1) A verified attempt can belong to a person (account), not only to the device that played it. The device actor
--    (arena_public_attempts.player_id) stays: anonymous training attempts have no account.
-- 2) game_id / game_version of a match as real columns (generated from the manifest, which stays the only source), so
--    rankings and play counts do not open the JSON of every row.
-- 3) Accounts are never deleted, they are anonymised (the money ledger must be kept for the legal period).
ALTER TABLE arena_public_attempts ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES arena_accounts(account_id);
CREATE INDEX IF NOT EXISTS arena_public_attempts_account ON arena_public_attempts(account_id, started_at) WHERE account_id IS NOT NULL;

ALTER TABLE arena_matches ADD COLUMN IF NOT EXISTS game_id text GENERATED ALWAYS AS (manifest ->> 'game_id') STORED;
ALTER TABLE arena_matches ADD COLUMN IF NOT EXISTS game_version text GENERATED ALWAYS AS (manifest ->> 'game_version') STORED;
CREATE INDEX IF NOT EXISTS arena_matches_game ON arena_matches(game_id, game_version, stored_at);
CREATE INDEX IF NOT EXISTS arena_matches_stored ON arena_matches(stored_at);

ALTER TABLE arena_accounts ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE OR REPLACE FUNCTION arena_accounts_keep() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'accounts are anonymised, never deleted' USING ERRCODE = '23514';
END $$;
DROP TRIGGER IF EXISTS arena_accounts_no_delete ON arena_accounts;
CREATE TRIGGER arena_accounts_no_delete BEFORE DELETE ON arena_accounts FOR EACH ROW EXECUTE FUNCTION arena_accounts_keep();
