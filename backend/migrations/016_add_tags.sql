-- +goose Up
CREATE TABLE IF NOT EXISTS tags (
    userID TEXT NOT NULL REFERENCES users(ID) ON DELETE CASCADE,
    immichID TEXT NOT NULL,
    name TEXT NOT NULL,
    value TEXT NOT NULL,
    parentID TEXT,
    color TEXT,
    updatedAt TEXT NOT NULL,
    PRIMARY KEY (userID, immichID)
);

CREATE TABLE IF NOT EXISTS assetTags (
    userID TEXT NOT NULL,
    tagID TEXT NOT NULL,
    assetID TEXT NOT NULL,
    PRIMARY KEY (userID, tagID, assetID),
    FOREIGN KEY (userID, tagID) REFERENCES tags(userID, immichID) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_asset_tags_asset ON assetTags(userID, assetID);

-- +goose Down
DROP INDEX IF EXISTS idx_asset_tags_asset;
DROP TABLE IF EXISTS assetTags;
DROP TABLE IF EXISTS tags;
