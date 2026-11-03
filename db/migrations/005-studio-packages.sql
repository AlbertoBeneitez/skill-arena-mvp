-- Explicit, additive PostgreSQL migration (v142). Never applied during startup/build. Requires 004.
-- Studios now send the game itself: one package file (galactic.json, game.html, core.wasm, cover) that passed the
-- automatic admission check at upload. The row keeps the package, its digest, the manifest, the check report, the
-- versions of the conditions and the privacy notice accepted, and the owner's review status.
ALTER TABLE studio_game_proposals ALTER COLUMN link DROP NOT NULL;
ALTER TABLE studio_game_proposals ADD COLUMN IF NOT EXISTS package bytea CHECK (package IS NULL OR octet_length(package) <= 4194304);
ALTER TABLE studio_game_proposals ADD COLUMN IF NOT EXISTS package_sha256 text CHECK (package_sha256 IS NULL OR package_sha256 ~ '^[0-9a-f]{64}$');
ALTER TABLE studio_game_proposals ADD COLUMN IF NOT EXISTS manifest jsonb;
ALTER TABLE studio_game_proposals ADD COLUMN IF NOT EXISTS report jsonb;
ALTER TABLE studio_game_proposals ADD COLUMN IF NOT EXISTS terms_version text;
ALTER TABLE studio_game_proposals ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'received'
  CHECK (review_status IN ('received', 'approved', 'rejected'));
ALTER TABLE studio_game_proposals ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
