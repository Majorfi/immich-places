-- +goose Up
CREATE TABLE IF NOT EXISTS favoritePlaces (
    ID INTEGER PRIMARY KEY AUTOINCREMENT,
    userID TEXT NOT NULL REFERENCES users(ID) ON DELETE CASCADE,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    displayName TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(userID, latitude, longitude)
);

CREATE INDEX IF NOT EXISTS idx_favorite_places_user ON favoritePlaces(userID);

-- +goose Down
DROP INDEX IF EXISTS idx_favorite_places_user;
DROP TABLE IF EXISTS favoritePlaces;
