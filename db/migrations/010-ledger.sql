-- v193 · Foundation 2. Additive only. Double-entry money ledger: every operation is one transaction whose postings add
-- up to zero in each currency, so money is never created or lost; both sides (player, house, competition pot, studios,
-- the exchange) are recorded. Postings and transactions are never edited or deleted. 1 CC (cosmicoin) = 1 euro cent.
-- Player and pot accounts can never go below zero; system accounts (house, conversion, external, studios) can.
CREATE TABLE IF NOT EXISTS arena_ledger_accounts (
  ledger_account_id bigserial PRIMARY KEY,
  kind              text NOT NULL CHECK (kind IN ('player', 'pot', 'house', 'conversion', 'external', 'studios')),
  currency          text NOT NULL CHECK (currency IN ('EUR', 'CC')),
  scope             text NOT NULL DEFAULT 'fictitious' CHECK (scope IN ('fictitious', 'real')),
  owner_account_id  uuid REFERENCES arena_accounts(account_id),
  competition_id    uuid REFERENCES arena_competitions(competition_id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ledger_account_id, currency),
  CHECK ((kind = 'player' AND owner_account_id IS NOT NULL AND competition_id IS NULL)
      OR (kind = 'pot' AND competition_id IS NOT NULL AND owner_account_id IS NULL)
      OR (kind NOT IN ('player', 'pot') AND owner_account_id IS NULL AND competition_id IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS arena_ledger_player_once ON arena_ledger_accounts(owner_account_id, currency, scope) WHERE kind = 'player';
CREATE UNIQUE INDEX IF NOT EXISTS arena_ledger_pot_once ON arena_ledger_accounts(competition_id, currency, scope) WHERE kind = 'pot';
CREATE UNIQUE INDEX IF NOT EXISTS arena_ledger_system_once ON arena_ledger_accounts(kind, currency, scope) WHERE kind NOT IN ('player', 'pot');

CREATE TABLE IF NOT EXISTS arena_ledger_transactions (
  tx_id          uuid PRIMARY KEY,
  kind           text NOT NULL CHECK (kind IN ('welcome', 'deposit', 'withdraw', 'entry', 'prize', 'refund', 'fee', 'studio_share', 'adjustment', 'reversal')),
  scope          text NOT NULL DEFAULT 'fictitious' CHECK (scope IN ('fictitious', 'real')),
  account_id     uuid REFERENCES arena_accounts(account_id),
  competition_id uuid REFERENCES arena_competitions(competition_id),
  request_key    text,
  detail         jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(detail) = 'object'),
  created_at     timestamptz NOT NULL DEFAULT now()
);
-- A retried request (same person, key and kind) never posts twice.
CREATE UNIQUE INDEX IF NOT EXISTS arena_ledger_tx_request ON arena_ledger_transactions(account_id, request_key, kind) WHERE request_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS arena_ledger_tx_competition ON arena_ledger_transactions(competition_id, kind) WHERE competition_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS arena_ledger_postings (
  posting_id        bigserial PRIMARY KEY,
  tx_id             uuid NOT NULL REFERENCES arena_ledger_transactions(tx_id),
  ledger_account_id bigint NOT NULL,
  currency          text NOT NULL,
  amount_minor      bigint NOT NULL CHECK (amount_minor <> 0),
  -- The posting's currency must be the account's currency.
  FOREIGN KEY (ledger_account_id, currency) REFERENCES arena_ledger_accounts(ledger_account_id, currency)
);
CREATE INDEX IF NOT EXISTS arena_ledger_postings_account ON arena_ledger_postings(ledger_account_id, posting_id);
CREATE INDEX IF NOT EXISTS arena_ledger_postings_tx ON arena_ledger_postings(tx_id);

-- At commit: the transaction adds up to zero in every currency, every account has the transaction's scope, and
-- no player or pot account ends below zero.
CREATE OR REPLACE FUNCTION arena_ledger_check() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE bad record;
BEGIN
  SELECT currency, sum(amount_minor) AS total INTO bad FROM arena_ledger_postings WHERE tx_id = NEW.tx_id GROUP BY currency HAVING sum(amount_minor) <> 0 LIMIT 1;
  IF FOUND THEN RAISE EXCEPTION 'ledger transaction % does not add up to zero in %', NEW.tx_id, bad.currency USING ERRCODE = '23514'; END IF;
  PERFORM 1 FROM arena_ledger_postings p JOIN arena_ledger_accounts a USING (ledger_account_id) JOIN arena_ledger_transactions t ON t.tx_id = p.tx_id
   WHERE p.tx_id = NEW.tx_id AND a.scope <> t.scope LIMIT 1;
  IF FOUND THEN RAISE EXCEPTION 'ledger transaction % mixes fictitious and real accounts', NEW.tx_id USING ERRCODE = '23514'; END IF;
  SELECT a.ledger_account_id INTO bad FROM arena_ledger_postings p JOIN arena_ledger_accounts a USING (ledger_account_id)
   WHERE p.tx_id = NEW.tx_id AND a.kind IN ('player', 'pot')
     AND (SELECT sum(q.amount_minor) FROM arena_ledger_postings q WHERE q.ledger_account_id = a.ledger_account_id) < 0 LIMIT 1;
  IF FOUND THEN RAISE EXCEPTION 'ledger account % would go below zero', bad.ledger_account_id USING ERRCODE = '23514'; END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS arena_ledger_balanced ON arena_ledger_postings;
CREATE CONSTRAINT TRIGGER arena_ledger_balanced AFTER INSERT ON arena_ledger_postings
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION arena_ledger_check();

CREATE OR REPLACE FUNCTION arena_ledger_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% rows are never edited or deleted', TG_TABLE_NAME USING ERRCODE = '23514';
END $$;
DROP TRIGGER IF EXISTS arena_ledger_tx_immutable ON arena_ledger_transactions;
CREATE TRIGGER arena_ledger_tx_immutable BEFORE UPDATE OR DELETE ON arena_ledger_transactions FOR EACH ROW EXECUTE FUNCTION arena_ledger_immutable();
DROP TRIGGER IF EXISTS arena_ledger_posting_immutable ON arena_ledger_postings;
CREATE TRIGGER arena_ledger_posting_immutable BEFORE UPDATE OR DELETE ON arena_ledger_postings FOR EACH ROW EXECUTE FUNCTION arena_ledger_immutable();

-- Accounts that already had a wallet (before this ledger) keep their balance: one adjustment from the house.
DO $$
DECLARE r record; la bigint; ha bigint; t uuid;
BEGIN
  FOR r IN SELECT a.account_id, (SELECT balance_after FROM arena_wallet_entries w WHERE w.account_id = a.account_id ORDER BY entry_id DESC LIMIT 1) AS balance
             FROM arena_accounts a
            WHERE NOT EXISTS (SELECT 1 FROM arena_ledger_accounts l WHERE l.kind = 'player' AND l.owner_account_id = a.account_id)
  LOOP
    IF r.balance IS NULL OR r.balance = 0 THEN CONTINUE; END IF;
    INSERT INTO arena_ledger_accounts(kind, currency) VALUES ('house', 'CC') ON CONFLICT DO NOTHING;
    SELECT ledger_account_id INTO ha FROM arena_ledger_accounts WHERE kind = 'house' AND currency = 'CC' AND scope = 'fictitious';
    INSERT INTO arena_ledger_accounts(kind, currency, owner_account_id) VALUES ('player', 'CC', r.account_id) RETURNING ledger_account_id INTO la;
    t := gen_random_uuid();
    INSERT INTO arena_ledger_transactions(tx_id, kind, account_id, detail) VALUES (t, 'adjustment', r.account_id, '{"backfill":"wallet-entries"}');
    INSERT INTO arena_ledger_postings(tx_id, ledger_account_id, currency, amount_minor) VALUES (t, ha, 'CC', -r.balance), (t, la, 'CC', r.balance);
  END LOOP;
END $$;
