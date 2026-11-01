-- Explicit, additive PostgreSQL migration (v135). Never applied during startup/build.
-- Game proposals sent by external studios from the app. Personal data kept to the minimum needed to review the
-- proposal and answer it (studio name and a contact e-mail); the owner deletes each proposal once it is answered.
CREATE TABLE IF NOT EXISTS studio_game_proposals (
 proposal_id uuid PRIMARY KEY,
 created_at timestamptz NOT NULL DEFAULT now(),
 studio text NOT NULL CHECK(char_length(studio) BETWEEN 2 AND 80),
 contact text NOT NULL CHECK(char_length(contact) BETWEEN 6 AND 120),
 game text NOT NULL CHECK(char_length(game) BETWEEN 2 AND 60),
 shelf text NOT NULL CHECK(shelf IN ('casino','bar','mythic','dynamic','alternative')),
 summary text NOT NULL CHECK(char_length(summary) BETWEEN 10 AND 280),
 link text NOT NULL CHECK(link LIKE 'https://%' AND char_length(link) <= 300),
 consent_version text NOT NULL
);
CREATE INDEX IF NOT EXISTS studio_game_proposals_created ON studio_game_proposals(created_at DESC);
