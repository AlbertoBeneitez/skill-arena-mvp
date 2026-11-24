-- v230 · In-app notices (owner, 20-nov-2026: good news only — a group accepts your challenge, it is your turn to play,
-- you win a matchday or a competition). Additive only. Rows are written by the server in the same transaction that
-- decides the fact (lib/server/notifications.ts), never by the phone. Each notice keeps only what its text needs
-- (competition, matchday, game, group name). Deleted after 30 days and together with the account (deleteAccount).
CREATE TABLE IF NOT EXISTS arena_notifications (
  notification_id uuid PRIMARY KEY,
  account_id      uuid NOT NULL REFERENCES arena_accounts(account_id) ON DELETE CASCADE,
  kind            text NOT NULL CHECK (kind IN ('challenge-accepted','your-turn','matchday-won','competition-won')),
  data            jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(data) = 'object' AND octet_length(data::text) <= 1024),
  dedupe_key      text NOT NULL CHECK (char_length(dedupe_key) BETWEEN 1 AND 200),
  created_at      timestamptz NOT NULL DEFAULT now(),
  read_at         timestamptz,
  UNIQUE (account_id, dedupe_key)
);
CREATE INDEX IF NOT EXISTS arena_notifications_inbox ON arena_notifications(account_id, created_at DESC);

-- What each person wants to be told and where («App» / «Móvil»). Absent row = the defaults (everything on in the app).
CREATE TABLE IF NOT EXISTS arena_notification_settings (
  account_id uuid PRIMARY KEY REFERENCES arena_accounts(account_id) ON DELETE CASCADE,
  settings   jsonb NOT NULL CHECK (jsonb_typeof(settings) = 'object' AND octet_length(settings::text) <= 512),
  updated_at timestamptz NOT NULL DEFAULT now()
);
