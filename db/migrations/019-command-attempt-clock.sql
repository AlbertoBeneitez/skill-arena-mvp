-- Solitaire Sprint 1.0.0 · server clock for hidden-information attempts (owner, 22-nov-2026: the fastest solve wins,
-- 5 minutes maximum). Additive only. started_at is when the server created the attempt; finished_at is when it
-- accepted the terminal command (or the deadline, when the server closed it for time). Rows that existed before this
-- migration get started_at = the migration time; their game has no time rule, so nothing reads it.
ALTER TABLE arena_command_attempts ADD COLUMN IF NOT EXISTS started_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE arena_command_attempts ADD COLUMN IF NOT EXISTS finished_at timestamptz;
DO $$ BEGIN
 ALTER TABLE arena_command_attempts ADD CONSTRAINT arena_command_attempts_clock_order
  CHECK (finished_at IS NULL OR finished_at >= started_at);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
