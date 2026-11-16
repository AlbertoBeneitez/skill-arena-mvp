-- v207 · Fix (introduced by 008): the generated columns game_id/game_version are not yet computed in a BEFORE UPDATE
-- trigger, so NEW differed from OLD and the rewrite guard refused the only allowed update (setting player_b when a rival
-- joins). The guard now ignores those two derived columns; they come from the manifest, which it still compares.
CREATE OR REPLACE FUNCTION arena_prevent_match_rewrite()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (to_jsonb(NEW) - 'game_id' - 'game_version') IS DISTINCT FROM (to_jsonb(OLD) - 'game_id' - 'game_version') AND NOT (
  OLD.player_b IS NULL AND NEW.player_b IS NOT NULL
  AND (to_jsonb(NEW) - 'player_b' - 'game_id' - 'game_version') = (to_jsonb(OLD) - 'player_b' - 'game_id' - 'game_version')
 ) THEN RAISE EXCEPTION 'IMMUTABLE_MATCH' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END;
$$;
