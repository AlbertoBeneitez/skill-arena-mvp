-- v203 · Additive. A "solo" public match is played against an invented rival (Offline mode, local groups): it is
-- verified like any other but never offered to, nor joined by, another player.
ALTER TABLE arena_public_matches ADD COLUMN IF NOT EXISTS solo boolean NOT NULL DEFAULT false;
