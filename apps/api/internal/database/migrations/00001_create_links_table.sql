-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS links (
    id TEXT PRIMARY KEY,
    original_url TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL DEFAULT '',
    clicks INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    last_clicked_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_links_code ON links (code);
CREATE INDEX IF NOT EXISTS idx_links_created_at ON links (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_links_is_active ON links (is_active);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS links;
-- +goose StatementEnd
