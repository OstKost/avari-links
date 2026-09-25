-- +goose Up
-- +goose StatementBegin
ALTER TABLE anonymous_sessions ADD COLUMN is_premium INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_sessions_is_premium ON anonymous_sessions (is_premium);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS idx_sessions_is_premium;
ALTER TABLE anonymous_sessions DROP COLUMN is_premium;
-- +goose StatementEnd
