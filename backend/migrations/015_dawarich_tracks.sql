-- +goose Up
CREATE TABLE IF NOT EXISTS dawarichTracks (
    ID INTEGER NOT NULL,
    userID TEXT NOT NULL,
    name TEXT NOT NULL,
    startedAt TEXT NOT NULL,
    finishedAt TEXT NOT NULL,
    distance REAL NOT NULL DEFAULT 0,
    duration INTEGER NOT NULL DEFAULT 0,
    syncedAt TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (userID, ID)
);

CREATE TABLE IF NOT EXISTS dawarichTrackPoints (
    userID TEXT NOT NULL,
    trackID INTEGER NOT NULL,
    timestamp INTEGER NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    altitude INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (userID, trackID, timestamp),
    FOREIGN KEY (userID, trackID) REFERENCES dawarichTracks(userID, ID) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_dawarich_points_track
    ON dawarichTrackPoints(userID, trackID, timestamp ASC);

-- +goose Down
DROP INDEX IF EXISTS idx_dawarich_points_track;
DROP TABLE IF EXISTS dawarichTrackPoints;
DROP TABLE IF EXISTS dawarichTracks;
