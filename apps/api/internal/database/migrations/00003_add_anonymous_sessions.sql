-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS anonymous_sessions (
    id TEXT PRIMARY KEY,
    key_hash TEXT NOT NULL UNIQUE,
    last_active_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_key_hash ON anonymous_sessions (key_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_last_active ON anonymous_sessions (last_active_at);

ALTER TABLE links ADD COLUMN user_id TEXT REFERENCES anonymous_sessions(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_links_user_id ON links (user_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS idx_links_user_id;
ALTER TABLE links DROP COLUMN user_id;
DROP TABLE IF EXISTS anonymous_sessions;
-- +goose StatementEnd
