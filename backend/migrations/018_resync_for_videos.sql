-- +goose Up
CREATE INDEX idx_assets_type_page_position ON assets(userID, type, fileCreatedAt DESC, immichID DESC);
DELETE FROM syncState WHERE key = 'lastSyncAt';

-- +goose Down
DROP INDEX IF EXISTS idx_assets_type_page_position;
