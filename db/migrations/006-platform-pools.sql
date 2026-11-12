-- v179 · Explicit forward migration (additive): public matches belong to one platform, so phones are paired only
-- with phones and computers only with computers. Every existing match was played on the phone-only app: 'mobile'.
ALTER TABLE arena_public_matches ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'mobile';
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='arena_public_matches_platform_check') THEN
  ALTER TABLE arena_public_matches ADD CONSTRAINT arena_public_matches_platform_check CHECK(platform IN ('mobile','desktop'));
 END IF;
END $$;
CREATE INDEX IF NOT EXISTS arena_public_open_by_platform ON arena_public_matches(platform) WHERE resolution IS NULL;
