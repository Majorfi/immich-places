-- +goose Up
CREATE TABLE IF NOT EXISTS libraries (
    userID TEXT NOT NULL REFERENCES users(ID) ON DELETE CASCADE,
    libraryID TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    assetCount INTEGER NOT NULL DEFAULT 0,
    isHidden INTEGER NOT NULL DEFAULT 0,
    syncedAt TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (userID, libraryID)
);

ALTER TABLE assets ADD COLUMN libraryID TEXT;

-- +goose Down
ALTER TABLE assets DROP COLUMN libraryID;
DROP TABLE IF EXISTS libraries;
