-- +goose Up
ALTER TABLE assets ADD COLUMN originalPath TEXT NOT NULL DEFAULT '';
CREATE INDEX idx_assets_originalPath ON assets(userID, originalPath);

-- +goose Down
DROP INDEX IF EXISTS idx_assets_originalPath;
ALTER TABLE assets DROP COLUMN originalPath;
