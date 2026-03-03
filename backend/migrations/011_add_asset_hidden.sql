-- +goose Up
ALTER TABLE assets ADD COLUMN isHidden INTEGER NOT NULL DEFAULT 0;

-- +goose Down
ALTER TABLE assets DROP COLUMN isHidden;
