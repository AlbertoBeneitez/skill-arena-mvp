-- v228 · Retention of match inputs (owner decision, 21-nov-2026: 90 days). Additive only: no row is deleted.
-- After 90 days the retention job replaces an attempt's ordered inputs (record) with a small stub
-- ({record_kind, pruned_at}); the result (response, score), the record hash, the manifest and every reference stay, so
-- rankings, play counts, group results and the ledger are unchanged. Only the job may do it (SET LOCAL arena.retention).
CREATE OR REPLACE FUNCTION arena_public_record_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF current_setting('arena.retention', true) = 'on'
  AND OLD.record IS NOT NULL AND NEW.record ? 'pruned_at' AND NOT (OLD.record ? 'pruned_at')
  AND (to_jsonb(NEW) - 'record') = (to_jsonb(OLD) - 'record')
 THEN RETURN NEW; END IF;
 IF NEW.attempt_id<>OLD.attempt_id OR NEW.match_id<>OLD.match_id OR NEW.player_id<>OLD.player_id
 OR NEW.slot<>OLD.slot OR NEW.ticket<>OLD.ticket OR NEW.start_key<>OLD.start_key
 OR NEW.request_hash<>OLD.request_hash OR NEW.started_at<>OLD.started_at OR NEW.deadline<>OLD.deadline
 OR (OLD.record IS NOT NULL AND (NEW.record IS DISTINCT FROM OLD.record OR NEW.record_hash IS DISTINCT FROM OLD.record_hash OR NEW.record_received_at IS DISTINCT FROM OLD.record_received_at))
 OR (OLD.response IS NOT NULL AND NEW.response IS DISTINCT FROM OLD.response)
 OR (OLD.state IN ('verified','rejected','forfeited') AND NEW.state<>OLD.state)
 THEN RAISE EXCEPTION 'IMMUTABLE_ATTEMPT' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END;
$$;
CREATE INDEX IF NOT EXISTS arena_public_attempts_unpruned ON arena_public_attempts(started_at) WHERE record IS NOT NULL AND NOT (record ? 'pruned_at');
