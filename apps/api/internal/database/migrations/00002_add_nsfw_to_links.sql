-- +goose Up
ALTER TABLE links ADD COLUMN is_nsfw INTEGER NOT NULL DEFAULT 0;

-- +goose Down
ALTER TABLE links DROP COLUMN is_nsfw;
