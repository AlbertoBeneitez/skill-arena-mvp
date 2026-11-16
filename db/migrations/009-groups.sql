-- v193 · Foundation 4. Additive only. Groups, leagues, tournaments and group-against-group on the server. The rules
-- live in lib/groupCompetition.ts and lib/groupVersus.ts (pure code); these tables keep who plays, what they paid and
-- every result, each tied to a verified attempt. Groups, competitions and rankings never mix platforms.
CREATE TABLE IF NOT EXISTS arena_groups (
  group_id         uuid PRIMARY KEY,
  name             text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 30),
  code             text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9]{6,10}$'),
  owner_account_id uuid NOT NULL REFERENCES arena_accounts(account_id),
  platform         text NOT NULL CHECK (platform IN ('mobile', 'desktop')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  closed_at        timestamptz
);
CREATE INDEX IF NOT EXISTS arena_groups_platform ON arena_groups(platform) WHERE closed_at IS NULL;

CREATE TABLE IF NOT EXISTS arena_group_members (
  group_id   uuid NOT NULL REFERENCES arena_groups(group_id),
  account_id uuid NOT NULL REFERENCES arena_accounts(account_id),
  role       text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at  timestamptz NOT NULL DEFAULT now(),
  left_at    timestamptz,
  PRIMARY KEY (group_id, account_id)
);
CREATE INDEX IF NOT EXISTS arena_group_members_account ON arena_group_members(account_id) WHERE left_at IS NULL;

CREATE TABLE IF NOT EXISTS arena_competitions (
  competition_id uuid PRIMARY KEY,
  mode           text NOT NULL CHECK (mode IN ('group', 'versus-league', 'versus-tournament')),
  -- Version of the rules code that runs it: a published competition keeps its rules.
  rules_version  text NOT NULL,
  platform       text NOT NULL CHECK (platform IN ('mobile', 'desktop')),
  entry_minor    bigint NOT NULL DEFAULT 0 CHECK (entry_minor >= 0),
  config         jsonb NOT NULL CHECK (jsonb_typeof(config) = 'object'),
  status         text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'running', 'finished', 'cancelled')),
  -- The running competition (lib/groupCompetition.ts) once it starts; state_version guards concurrent writers.
  state          jsonb,
  state_version  integer NOT NULL DEFAULT 0 CHECK (state_version >= 0),
  result         jsonb,
  created_by     uuid NOT NULL REFERENCES arena_accounts(account_id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  started_at     timestamptz,
  finished_at    timestamptz
);
CREATE INDEX IF NOT EXISTS arena_competitions_open ON arena_competitions(platform, mode, created_at) WHERE status = 'open';

CREATE TABLE IF NOT EXISTS arena_competition_groups (
  competition_id uuid NOT NULL REFERENCES arena_competitions(competition_id),
  group_id       uuid NOT NULL REFERENCES arena_groups(group_id),
  side           smallint NOT NULL CHECK (side IN (0, 1)),
  PRIMARY KEY (competition_id, group_id),
  UNIQUE (competition_id, side)
);

CREATE TABLE IF NOT EXISTS arena_competition_players (
  competition_id uuid NOT NULL REFERENCES arena_competitions(competition_id),
  account_id     uuid NOT NULL REFERENCES arena_accounts(account_id),
  group_id       uuid NOT NULL REFERENCES arena_groups(group_id),
  entered_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (competition_id, account_id)
);
CREATE INDEX IF NOT EXISTS arena_competition_players_account ON arena_competition_players(account_id);

-- Every score of a competition comes from a verified attempt (the server writes it; the browser never sends a score).
CREATE TABLE IF NOT EXISTS arena_competition_results (
  competition_id uuid NOT NULL REFERENCES arena_competitions(competition_id),
  match_index    integer NOT NULL CHECK (match_index >= 0),
  account_id     uuid NOT NULL REFERENCES arena_accounts(account_id),
  score          double precision NOT NULL,
  time_ms        integer CHECK (time_ms IS NULL OR time_ms >= 0),
  attempt_id     text NOT NULL REFERENCES arena_public_attempts(attempt_id),
  recorded_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (competition_id, match_index, account_id),
  UNIQUE (attempt_id)
);
