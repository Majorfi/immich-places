package main

import (
	"database/sql"
	"path/filepath"
	"testing"

	_ "modernc.org/sqlite"
)

func openTestSQLite(t *testing.T) *sql.DB {
	t.Helper()
	dbPath := filepath.Join(t.TempDir(), "test.db")
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		t.Fatalf("failed to open sqlite: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	return db
}

func TestRunMigrationsFreshDatabase(t *testing.T) {
	db := openTestSQLite(t)

	if err := runMigrations(db); err != nil {
		t.Fatalf("runMigrations on fresh DB: %v", err)
	}

	var count int
	if err := db.QueryRow("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='assets'").Scan(&count); err != nil {
		t.Fatalf("query sqlite_master: %v", err)
	}
	if count != 1 {
		t.Error("expected assets table to exist after migration")
	}

	if !gooseTableExists(db) {
		t.Error("expected goose_db_version table to exist")
	}
}

func TestRunMigrationsBootstrapExistingDatabase(t *testing.T) {
	db := openTestSQLite(t)

	if _, err := db.Exec(`CREATE TABLE assets (
		immichID TEXT PRIMARY KEY,
		type TEXT NOT NULL,
		originalFileName TEXT NOT NULL,
		fileCreatedAt TEXT NOT NULL,
		latitude REAL,
		longitude REAL,
		city TEXT,
		state TEXT,
		country TEXT,
		dateTimeOriginal TEXT,
		syncedAt TEXT NOT NULL DEFAULT (datetime('now')),
		stackID TEXT,
		stackPrimaryAssetID TEXT,
		stackAssetCount INTEGER
	)`); err != nil {
		t.Fatalf("create legacy assets table: %v", err)
	}

	if _, err := db.Exec(`CREATE TABLE frequentLocations (
		ID INTEGER PRIMARY KEY AUTOINCREMENT,
		latitude REAL NOT NULL,
		longitude REAL NOT NULL,
		label TEXT NOT NULL,
		assetCount INTEGER NOT NULL DEFAULT 0
	)`); err != nil {
		t.Fatalf("create legacy frequentLocations table: %v", err)
	}

	if _, err := db.Exec(`CREATE TABLE albums (
		immichID TEXT PRIMARY KEY,
		albumName TEXT NOT NULL,
		thumbnailAssetID TEXT,
		assetCount INTEGER NOT NULL DEFAULT 0,
		updatedAt TEXT NOT NULL,
		startDate TEXT
	)`); err != nil {
		t.Fatalf("create legacy albums table: %v", err)
	}

	if _, err := db.Exec(`CREATE TABLE albumAssets (
		albumID TEXT REFERENCES albums(immichID) ON DELETE CASCADE,
		assetID TEXT,
		PRIMARY KEY (albumID, assetID)
	)`); err != nil {
		t.Fatalf("create legacy albumAssets table: %v", err)
	}

	if _, err := db.Exec(`CREATE TABLE syncState (
		key TEXT PRIMARY KEY,
		value TEXT NOT NULL
	)`); err != nil {
		t.Fatalf("create legacy syncState table: %v", err)
	}

	if gooseTableExists(db) {
		t.Fatal("goose table should not exist before bootstrap")
	}

	if err := runMigrations(db); err != nil {
		t.Fatalf("runMigrations on existing DB: %v", err)
	}

	if !gooseTableExists(db) {
		t.Error("expected goose_db_version table after bootstrap")
	}

	var version int
	if err := db.QueryRow("SELECT version_id FROM goose_db_version WHERE is_applied = 1 ORDER BY id DESC LIMIT 1").Scan(&version); err != nil {
		t.Fatalf("query goose version: %v", err)
	}
	if version != 13 {
		t.Errorf("expected stamped version 13, got %d", version)
	}

	if _, err := db.Exec("INSERT INTO users (ID, email, passwordHash) VALUES ('u1', 'test@example.com', 'hashed')"); err != nil {
		t.Fatalf("insert test user: %v", err)
	}
	if _, err := db.Exec("INSERT INTO assets (userID, immichID, type, originalFileName, fileCreatedAt) VALUES ('u1', 'test', 'IMAGE', 'test.jpg', '2024-01-01T00:00:00Z')"); err != nil {
		t.Errorf("insert into assets should still work after bootstrap: %v", err)
	}
}

func TestLegacyDataPreservedDuringUpgrade(t *testing.T) {
	db := openTestSQLite(t)

	if _, err := db.Exec(`CREATE TABLE assets (
		immichID TEXT PRIMARY KEY,
		type TEXT NOT NULL,
		originalFileName TEXT NOT NULL,
		fileCreatedAt TEXT NOT NULL,
		latitude REAL,
		longitude REAL,
		city TEXT,
		state TEXT,
		country TEXT,
		dateTimeOriginal TEXT,
		syncedAt TEXT NOT NULL DEFAULT (datetime('now')),
		stackID TEXT,
		stackPrimaryAssetID TEXT,
		stackAssetCount INTEGER
	)`); err != nil {
		t.Fatalf("create legacy assets: %v", err)
	}

	if _, err := db.Exec(`CREATE TABLE frequentLocations (
		ID INTEGER PRIMARY KEY AUTOINCREMENT,
		latitude REAL NOT NULL,
		longitude REAL NOT NULL,
		label TEXT NOT NULL,
		assetCount INTEGER NOT NULL DEFAULT 0
	)`); err != nil {
		t.Fatalf("create legacy frequentLocations: %v", err)
	}

	if _, err := db.Exec(`CREATE TABLE albums (
		immichID TEXT PRIMARY KEY,
		albumName TEXT NOT NULL,
		thumbnailAssetID TEXT,
		assetCount INTEGER NOT NULL DEFAULT 0,
		updatedAt TEXT NOT NULL,
		startDate TEXT
	)`); err != nil {
		t.Fatalf("create legacy albums: %v", err)
	}

	if _, err := db.Exec(`CREATE TABLE albumAssets (
		albumID TEXT REFERENCES albums(immichID) ON DELETE CASCADE,
		assetID TEXT,
		PRIMARY KEY (albumID, assetID)
	)`); err != nil {
		t.Fatalf("create legacy albumAssets: %v", err)
	}

	if _, err := db.Exec(`CREATE TABLE syncState (
		key TEXT PRIMARY KEY,
		value TEXT NOT NULL
	)`); err != nil {
		t.Fatalf("create legacy syncState: %v", err)
	}

	if _, err := db.Exec(`INSERT INTO assets (immichID, type, originalFileName, fileCreatedAt, latitude, longitude)
		VALUES ('asset1', 'IMAGE', 'photo.jpg', '2024-01-01T12:00:00Z', 48.85, 2.35)`); err != nil {
		t.Fatalf("insert legacy asset: %v", err)
	}
	if _, err := db.Exec(`INSERT INTO albums (immichID, albumName, assetCount, updatedAt)
		VALUES ('album1', 'Vacation', 1, '2024-01-01T00:00:00Z')`); err != nil {
		t.Fatalf("insert legacy album: %v", err)
	}
	if _, err := db.Exec(`INSERT INTO albumAssets (albumID, assetID) VALUES ('album1', 'asset1')`); err != nil {
		t.Fatalf("insert legacy albumAsset: %v", err)
	}
	if _, err := db.Exec(`INSERT INTO frequentLocations (latitude, longitude, label, assetCount)
		VALUES (48.85, 2.35, 'Paris', 10)`); err != nil {
		t.Fatalf("insert legacy frequentLocation: %v", err)
	}

	if err := runMigrations(db); err != nil {
		t.Fatalf("runMigrations on legacy DB with data: %v", err)
	}

	var assetCount int
	db.QueryRow("SELECT COUNT(*) FROM assets").Scan(&assetCount)
	if assetCount != 1 {
		t.Errorf("expected 1 asset preserved, got %d", assetCount)
	}

	var albumCount int
	db.QueryRow("SELECT COUNT(*) FROM albums").Scan(&albumCount)
	if albumCount != 1 {
		t.Errorf("expected 1 album preserved, got %d", albumCount)
	}

	var albumAssetCount int
	db.QueryRow("SELECT COUNT(*) FROM albumAssets").Scan(&albumAssetCount)
	if albumAssetCount != 1 {
		t.Errorf("expected 1 albumAsset preserved, got %d", albumAssetCount)
	}

	var freqCount int
	db.QueryRow("SELECT COUNT(*) FROM frequentLocations").Scan(&freqCount)
	if freqCount != 1 {
		t.Errorf("expected 1 frequentLocation preserved, got %d", freqCount)
	}

	var legacyUserCount int
	db.QueryRow("SELECT COUNT(*) FROM users WHERE ID = '__legacy__'").Scan(&legacyUserCount)
	if legacyUserCount != 1 {
		t.Errorf("expected __legacy__ placeholder user, got %d", legacyUserCount)
	}

	var assetUserID string
	db.QueryRow("SELECT userID FROM assets WHERE immichID = 'asset1'").Scan(&assetUserID)
	if assetUserID != "__legacy__" {
		t.Errorf("expected asset userID '__legacy__', got %q", assetUserID)
	}
}

func TestRunMigrationsIdempotent(t *testing.T) {
	db := openTestSQLite(t)

	if err := runMigrations(db); err != nil {
		t.Fatalf("first runMigrations: %v", err)
	}

	if err := runMigrations(db); err != nil {
		t.Fatalf("second runMigrations should be idempotent: %v", err)
	}
}
