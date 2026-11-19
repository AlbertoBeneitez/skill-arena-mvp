-- v220 · The picture a group's owner chose among the app's group pictures (lib/groupArt.ts). Additive only; NULL keeps
-- the default picture derived from the group. Photos are not stored on the server.
ALTER TABLE arena_groups ADD COLUMN IF NOT EXISTS art text CHECK (art IS NULL OR art ~ '^[a-z]{3,16}$');
