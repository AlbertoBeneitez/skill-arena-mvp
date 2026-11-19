-- v219 · Matches started per game for each account, so «Tu selección» (the games played, most played first) is the
-- same after signing in again or on another device. Additive only. Deleting an account removes its rows
-- (lib/server/accounts.ts › deleteAccount); a game id is checked against the catalogue before it is stored.
CREATE TABLE IF NOT EXISTS arena_play_counts (
  account_id uuid NOT NULL REFERENCES arena_accounts(account_id) ON DELETE CASCADE,
  game_id    text NOT NULL CHECK (game_id ~ '^[a-z0-9-]{1,40}$'),
  plays      integer NOT NULL DEFAULT 0 CHECK (plays >= 0 AND plays <= 1000000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, game_id)
);
