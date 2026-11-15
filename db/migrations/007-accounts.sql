-- v191 · Player accounts and their (fictitious) wallet, as registration will work for real players.
-- Additive only. One account per sign-in identity; the identity is stored as an HMAC (auth_key), never the provider's
-- raw account id. Names are unique by their folded form. The balance is the sum of an append-only ledger.
CREATE TABLE IF NOT EXISTS arena_accounts (
  account_id   uuid PRIMARY KEY,
  auth_key     text NOT NULL UNIQUE CHECK (auth_key ~ '^[0-9a-f]{64}$'),
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 18),
  name_key     text NOT NULL UNIQUE,
  avatar       smallint NOT NULL CHECK (avatar BETWEEN 1 AND 64),
  platform     text NOT NULL DEFAULT 'mobile' CHECK (platform IN ('mobile', 'desktop')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS arena_wallet_entries (
  entry_id      bigserial PRIMARY KEY,
  account_id    uuid NOT NULL REFERENCES arena_accounts(account_id) ON DELETE CASCADE,
  kind          text NOT NULL CHECK (kind IN ('welcome', 'deposit', 'withdraw')),
  -- Change of cosmicoins in the balance: + for welcome and deposits (after the fee), − for withdrawals.
  amount_minor  bigint NOT NULL CHECK (amount_minor <> 0),
  -- Exchange commission kept on this movement (5 %), in euro cents; 0 for the welcome balance.
  fee_minor     bigint NOT NULL DEFAULT 0 CHECK (fee_minor >= 0),
  balance_after bigint NOT NULL CHECK (balance_after >= 0),
  scope         text NOT NULL DEFAULT 'fictitious' CHECK (scope = 'fictitious'),
  request_key   text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS arena_wallet_entries_account ON arena_wallet_entries(account_id, entry_id DESC);
CREATE UNIQUE INDEX IF NOT EXISTS arena_wallet_entries_request ON arena_wallet_entries(account_id, request_key, kind) WHERE request_key IS NOT NULL;

-- Ledger rows are never edited; deleting the account (right to erasure) removes them with it.
CREATE OR REPLACE FUNCTION arena_wallet_entries_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'arena_wallet_entries rows are immutable';
END $$;
DROP TRIGGER IF EXISTS arena_wallet_entries_no_update ON arena_wallet_entries;
CREATE TRIGGER arena_wallet_entries_no_update BEFORE UPDATE ON arena_wallet_entries
  FOR EACH ROW EXECUTE FUNCTION arena_wallet_entries_immutable();
