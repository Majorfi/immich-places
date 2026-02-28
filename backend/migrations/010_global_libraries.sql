-- +goose Up
CREATE TABLE IF NOT EXISTS libraries_new (
    libraryID TEXT NOT NULL PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    assetCount INTEGER NOT NULL DEFAULT 0,
    isHidden INTEGER NOT NULL DEFAULT 0,
    syncedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR REPLACE INTO libraries_new (libraryID, name, assetCount, isHidden, syncedAt)
SELECT libraryID, name, assetCount, isHidden, syncedAt
FROM (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY libraryID ORDER BY syncedAt DESC, rowid DESC) AS rn
    FROM libraries
)
WHERE rn = 1;

DROP TABLE libraries;
ALTER TABLE libraries_new RENAME TO libraries;

-- +goose Down
CREATE TABLE IF NOT EXISTS libraries_old (
    userID TEXT NOT NULL REFERENCES users(ID) ON DELETE CASCADE,
    libraryID TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    assetCount INTEGER NOT NULL DEFAULT 0,
    isHidden INTEGER NOT NULL DEFAULT 0,
    syncedAt TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (userID, libraryID)
);

INSERT OR IGNORE INTO libraries_old (userID, libraryID, name, assetCount, isHidden, syncedAt)
SELECT DISTINCT a.userID, l.libraryID, l.name, l.assetCount, l.isHidden, l.syncedAt
FROM libraries l
JOIN assets a ON a.libraryID = l.libraryID;

DROP TABLE libraries;
ALTER TABLE libraries_old RENAME TO libraries;
