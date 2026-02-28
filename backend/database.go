package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

const (
	sqliteChunkSize = 500
	maxMapMarkers   = 50000
)

const assetColumns = `immichID, type, originalFileName, fileCreatedAt, latitude, longitude,
		city, state, country, dateTimeOriginal, syncedAt, stackID, stackPrimaryAssetID, stackAssetCount, libraryID`

const assetColumnsAliased = `a.immichID, a.type, a.originalFileName, a.fileCreatedAt, a.latitude, a.longitude,
		a.city, a.state, a.country, a.dateTimeOriginal, a.syncedAt, a.stackID, a.stackPrimaryAssetID, a.stackAssetCount, a.libraryID`

type Database struct {
	db            *sql.DB
	encryptionKey []byte
}

func newDatabase(dataDir string, encryptionKey string) (*Database, error) {
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create data directory: %w", err)
	}

	dbPath := filepath.Join(dataDir, "immich-places.db")
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	if _, err := db.Exec("PRAGMA journal_mode=WAL"); err != nil {
		return nil, fmt.Errorf("failed to set WAL mode: %w", err)
	}
	if _, err := db.Exec("PRAGMA foreign_keys=ON"); err != nil {
		return nil, fmt.Errorf("failed to enable foreign keys: %w", err)
	}
	if _, err := db.Exec("PRAGMA busy_timeout=5000"); err != nil {
		return nil, fmt.Errorf("failed to set busy timeout: %w", err)
	}

	if err := runMigrations(db); err != nil {
		return nil, fmt.Errorf("migrations: %w", err)
	}

	d := &Database{db: db, encryptionKey: deriveKey(encryptionKey)}

	log.Printf("Database initialized at %s", dbPath)
	return d, nil
}

func (d *Database) getSyncState(ctx context.Context, userID, key string) (*string, error) {
	var value string
	err := d.db.QueryRowContext(ctx, "SELECT value FROM syncState WHERE userID = ? AND key = ?", userID, key).Scan(&value)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &value, nil
}

func (d *Database) setSyncState(ctx context.Context, userID, key, value string) error {
	_, err := d.db.ExecContext(ctx,
		`INSERT INTO syncState (userID, key, value) VALUES (?, ?, ?)
		ON CONFLICT(userID, key) DO UPDATE SET value = excluded.value`,
		userID, key, value,
	)
	return err
}

func (d *Database) deleteSyncState(ctx context.Context, userID, key string) {
	d.db.ExecContext(ctx, "DELETE FROM syncState WHERE userID = ? AND key = ?", userID, key)
}

const hiddenLibraryFilter = ` AND (libraryID IS NULL OR libraryID NOT IN (
		SELECT libraryID FROM libraries WHERE isHidden = 1
	))`

const hiddenLibraryFilterAliased = ` AND (a.libraryID IS NULL OR a.libraryID NOT IN (
		SELECT libraryID FROM libraries WHERE isHidden = 1
	))`

const hiddenLibraryFilterAliasedAST = ` AND (ast.libraryID IS NULL OR ast.libraryID NOT IN (
		SELECT libraryID FROM libraries WHERE isHidden = 1
	))`

func (d *Database) countAssets(ctx context.Context, userID string) (int, error) {
	var count int
	err := d.db.QueryRowContext(ctx,
		"SELECT COUNT(*) FROM assets WHERE userID = ?"+hiddenLibraryFilter,
		userID,
	).Scan(&count)
	return count, err
}

func (d *Database) countNoGPSAssets(ctx context.Context, userID string) (int, error) {
	var count int
	err := d.db.QueryRowContext(ctx,
		"SELECT COUNT(*) FROM assets WHERE userID = ? AND (latitude IS NULL OR longitude IS NULL) AND stackPrimaryAssetID IS NULL"+hiddenLibraryFilter,
		userID,
	).Scan(&count)
	return count, err
}

type assetFilter struct {
	fromClause string
	args       []interface{}
	aliased    bool
}

func buildAssetFilter(userID, albumID string, withGPS bool) assetFilter {
	var f assetFilter
	if albumID != "" {
		f.aliased = true
		f.fromClause = `FROM assets a
			JOIN albumAssets aa ON aa.userID = a.userID AND aa.assetID = a.immichID
			WHERE a.userID = ? AND aa.albumID = ?`
		f.args = append(f.args, userID, albumID)
		if withGPS {
			f.fromClause += ` AND a.latitude IS NOT NULL AND a.longitude IS NOT NULL`
		} else {
			f.fromClause += ` AND (a.latitude IS NULL OR a.longitude IS NULL)`
		}
		f.fromClause += ` AND a.stackPrimaryAssetID IS NULL`
		f.fromClause += hiddenLibraryFilterAliased
	} else {
		f.fromClause = `FROM assets WHERE userID = ? AND`
		f.args = append(f.args, userID)
		if withGPS {
			f.fromClause += ` latitude IS NOT NULL AND longitude IS NOT NULL`
		} else {
			f.fromClause += ` (latitude IS NULL OR longitude IS NULL)`
		}
		f.fromClause += ` AND stackPrimaryAssetID IS NULL`
		f.fromClause += hiddenLibraryFilter
	}
	return f
}

func (d *Database) getFilteredAssets(ctx context.Context, userID, albumID string, withGPS bool, page, pageSize int) ([]AssetRow, error) {
	f := buildAssetFilter(userID, albumID, withGPS)

	cols := assetColumns
	orderPrefix := ""
	if f.aliased {
		cols = assetColumnsAliased
		orderPrefix = "a."
	}

	query := fmt.Sprintf(`SELECT %s %s ORDER BY %sfileCreatedAt DESC, %simmichID DESC LIMIT ? OFFSET ?`,
		cols, f.fromClause, orderPrefix, orderPrefix)
	args := append(f.args, pageSize, (page-1)*pageSize)

	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanAssetRows(rows)
}

func (d *Database) countFilteredAssets(ctx context.Context, userID, albumID string, withGPS bool) (int, error) {
	f := buildAssetFilter(userID, albumID, withGPS)
	query := `SELECT COUNT(*) ` + f.fromClause

	var count int
	err := d.db.QueryRowContext(ctx, query, f.args...).Scan(&count)
	return count, err
}

func (d *Database) getMapMarkers(ctx context.Context, userID, albumID string, bounds *TViewportBounds) ([]MapMarker, error) {
	var query string
	var args []interface{}

	if albumID != "" {
		query = `SELECT a.immichID, a.latitude, a.longitude
			FROM assets a
			JOIN albumAssets aa ON aa.userID = a.userID AND aa.assetID = a.immichID
			WHERE a.userID = ? AND aa.albumID = ? AND a.latitude IS NOT NULL AND a.longitude IS NOT NULL
				AND a.stackPrimaryAssetID IS NULL` + hiddenLibraryFilterAliased
		args = append(args, userID, albumID)
	} else {
		query = `SELECT immichID, latitude, longitude
			FROM assets
			WHERE userID = ? AND latitude IS NOT NULL AND longitude IS NOT NULL
				AND stackPrimaryAssetID IS NULL` + hiddenLibraryFilter
		args = append(args, userID)
	}

	if bounds != nil {
		prefix := ""
		if albumID != "" {
			prefix = "a."
		}
		query += fmt.Sprintf(` AND %slatitude BETWEEN ? AND ?`, prefix)
		args = append(args, bounds.South, bounds.North)
		if bounds.West > bounds.East {
			query += fmt.Sprintf(` AND (%slongitude >= ? OR %slongitude <= ?)`, prefix, prefix)
		} else {
			query += fmt.Sprintf(` AND %slongitude BETWEEN ? AND ?`, prefix)
		}
		args = append(args, bounds.West, bounds.East)
	}

	query += fmt.Sprintf(" LIMIT %d", maxMapMarkers)

	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var markers []MapMarker
	for rows.Next() {
		var m MapMarker
		if err := rows.Scan(&m.ImmichID, &m.Latitude, &m.Longitude); err != nil {
			return nil, err
		}
		markers = append(markers, m)
	}
	return markers, rows.Err()
}

func (d *Database) getAssetByID(ctx context.Context, userID, immichID string) (*AssetRow, error) {
	row := d.db.QueryRowContext(ctx,
		`SELECT `+assetColumns+`
		FROM assets WHERE userID = ? AND immichID = ?`+hiddenLibraryFilter,
		userID, immichID,
	)

	var a AssetRow
	err := row.Scan(
		&a.ImmichID, &a.Type, &a.OriginalFileName, &a.FileCreatedAt,
		&a.Latitude, &a.Longitude, &a.City, &a.State, &a.Country,
		&a.DateTimeOriginal, &a.SyncedAt, &a.StackID, &a.StackPrimaryAssetID, &a.StackAssetCount, &a.LibraryID,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &a, nil
}

const upsertAssetSQL = `INSERT INTO assets (immichID, userID, type, originalFileName, fileCreatedAt, latitude, longitude, city, state, country, dateTimeOriginal, stackID, stackPrimaryAssetID, stackAssetCount, libraryID, syncedAt)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
	ON CONFLICT(userID, immichID) DO UPDATE SET
		type = excluded.type,
		originalFileName = excluded.originalFileName,
		fileCreatedAt = excluded.fileCreatedAt,
		latitude = excluded.latitude,
		longitude = excluded.longitude,
		city = excluded.city,
		state = excluded.state,
		country = excluded.country,
		dateTimeOriginal = excluded.dateTimeOriginal,
		stackID = excluded.stackID,
		stackPrimaryAssetID = excluded.stackPrimaryAssetID,
		stackAssetCount = excluded.stackAssetCount,
		libraryID = excluded.libraryID,
		syncedAt = datetime('now')`

func (d *Database) upsertAssets(ctx context.Context, userID string, assets []AssetRow) error {
	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx, upsertAssetSQL)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, a := range assets {
		if _, err := stmt.ExecContext(ctx,
			a.ImmichID, userID, a.Type, a.OriginalFileName, a.FileCreatedAt,
			a.Latitude, a.Longitude, a.City, a.State, a.Country, a.DateTimeOriginal,
			a.StackID, a.StackPrimaryAssetID, a.StackAssetCount, a.LibraryID,
		); err != nil {
			return err
		}
	}

	return tx.Commit()
}

func parseTimestamp(s string) (time.Time, error) {
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		t, err = time.Parse("2006-01-02T15:04:05", s)
	}
	return t, err
}

func (d *Database) getSameDayAssets(ctx context.Context, userID, dateTimeOriginal string, hoursRange int) ([]AssetRow, error) {
	refTime, err := parseTimestamp(dateTimeOriginal)
	if err != nil {
		return nil, fmt.Errorf("failed to parse dateTimeOriginal: %w", err)
	}
	rangeStart := refTime.Add(-time.Duration(hoursRange) * time.Hour).Format(time.RFC3339)
	rangeEnd := refTime.Add(time.Duration(hoursRange) * time.Hour).Format(time.RFC3339)

	rows, err := d.db.QueryContext(ctx,
		`SELECT `+assetColumns+`
		FROM assets
		WHERE userID = ? AND latitude IS NOT NULL AND longitude IS NOT NULL
			AND dateTimeOriginal IS NOT NULL
			AND stackPrimaryAssetID IS NULL
			AND dateTimeOriginal BETWEEN ? AND ?`+hiddenLibraryFilter,
		userID, rangeStart, rangeEnd,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanAssetRows(rows)
}

func (d *Database) getFrequentLocations(ctx context.Context, userID string, limit int) ([]FrequentLocationRow, error) {
	rows, err := d.db.QueryContext(ctx,
		"SELECT latitude, longitude, label, assetCount FROM frequentLocations WHERE userID = ? ORDER BY assetCount DESC LIMIT ?",
		userID, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var locations []FrequentLocationRow
	for rows.Next() {
		var loc FrequentLocationRow
		if err := rows.Scan(&loc.Latitude, &loc.Longitude, &loc.Label, &loc.AssetCount); err != nil {
			return nil, err
		}
		locations = append(locations, loc)
	}
	return locations, rows.Err()
}

func (d *Database) replaceFrequentLocations(ctx context.Context, userID string, locations []FrequentLocationRow) error {
	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, "DELETE FROM frequentLocations WHERE userID = ?", userID); err != nil {
		return err
	}

	for _, loc := range locations {
		if _, err := tx.ExecContext(ctx,
			"INSERT INTO frequentLocations (userID, latitude, longitude, label, assetCount) VALUES (?, ?, ?, ?, ?)",
			userID, loc.Latitude, loc.Longitude, loc.Label, loc.AssetCount,
		); err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (d *Database) computeFrequentLocationClusters(ctx context.Context, userID string) ([]FrequentLocationRow, error) {
	rows, err := d.db.QueryContext(ctx,
		`SELECT ROUND(latitude, 2) as lat, ROUND(longitude, 2) as lon, COUNT(*) as cnt
		FROM assets
		WHERE userID = ? AND latitude IS NOT NULL AND longitude IS NOT NULL
			AND stackPrimaryAssetID IS NULL`+hiddenLibraryFilter+`
		GROUP BY ROUND(latitude, 2), ROUND(longitude, 2)
		ORDER BY cnt DESC
		LIMIT 20`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var clusters []FrequentLocationRow
	for rows.Next() {
		var loc FrequentLocationRow
		if err := rows.Scan(&loc.Latitude, &loc.Longitude, &loc.AssetCount); err != nil {
			return nil, err
		}
		clusters = append(clusters, loc)
	}
	return clusters, rows.Err()
}

func (d *Database) getAssetPageInfo(ctx context.Context, userID, assetID string, albumID string, pageSize int) (*AssetPageInfo, error) {
	var fileCreatedAt string
	err := d.db.QueryRowContext(ctx, "SELECT fileCreatedAt FROM assets WHERE immichID = ? AND userID = ?"+hiddenLibraryFilter, assetID, userID).Scan(&fileCreatedAt)
	if err != nil {
		return nil, fmt.Errorf("asset not found: %w", err)
	}

	if albumID != "" {
		inAlbum, err := d.isAssetInAlbum(ctx, userID, assetID, albumID)
		if err != nil {
			return nil, fmt.Errorf("failed to check album membership: %w", err)
		}
		if !inAlbum {
			albumID = ""
		}
	}

	var position int
	if albumID != "" {
		err = d.db.QueryRowContext(ctx,
			`SELECT COUNT(*) FROM assets a
			JOIN albumAssets aa ON aa.userID = a.userID AND aa.assetID = a.immichID
			WHERE a.userID = ? AND aa.albumID = ?
				AND a.latitude IS NOT NULL AND a.longitude IS NOT NULL
				AND a.stackPrimaryAssetID IS NULL
				AND (a.fileCreatedAt > ? OR (a.fileCreatedAt = ? AND a.immichID > ?))`+hiddenLibraryFilterAliased,
			userID, albumID, fileCreatedAt, fileCreatedAt, assetID,
		).Scan(&position)
	} else {
		err = d.db.QueryRowContext(ctx,
			`SELECT COUNT(*) FROM assets
			WHERE userID = ? AND latitude IS NOT NULL AND longitude IS NOT NULL
				AND stackPrimaryAssetID IS NULL
				AND (fileCreatedAt > ? OR (fileCreatedAt = ? AND immichID > ?))`+hiddenLibraryFilter,
			userID, fileCreatedAt, fileCreatedAt, assetID,
		).Scan(&position)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to count position: %w", err)
	}

	page := (position / pageSize) + 1

	info := &AssetPageInfo{Page: page}

	if albumID == "" {
		var foundAlbumID string
		err = d.db.QueryRowContext(ctx,
			"SELECT albumID FROM albumAssets WHERE userID = ? AND assetID = ? LIMIT 1",
			userID, assetID,
		).Scan(&foundAlbumID)
		if err == nil {
			info.AlbumID = &foundAlbumID
		}
	} else {
		info.AlbumID = &albumID
	}

	return info, nil
}

type stackUpdateRow struct {
	immichID       string
	stackID        string
	primaryAssetID *string
	assetCount     int
}

func (d *Database) batchUpdateStackInfo(ctx context.Context, userID string, updates []stackUpdateRow) (int, error) {
	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx,
		"UPDATE assets SET stackID = NULL, stackPrimaryAssetID = NULL, stackAssetCount = NULL WHERE userID = ? AND (stackID IS NOT NULL OR stackPrimaryAssetID IS NOT NULL)",
		userID,
	); err != nil {
		return 0, err
	}

	stmt, err := tx.PrepareContext(ctx, "UPDATE assets SET stackID = ?, stackPrimaryAssetID = ?, stackAssetCount = ? WHERE immichID = ? AND userID = ?")
	if err != nil {
		return 0, err
	}
	defer stmt.Close()

	updated := 0
	for _, u := range updates {
		if _, err := stmt.ExecContext(ctx, u.stackID, u.primaryAssetID, u.assetCount, u.immichID, userID); err != nil {
			return 0, err
		}
		updated++
	}

	return updated, tx.Commit()
}

func (d *Database) getAssetStackID(ctx context.Context, userID, immichID string) (*string, error) {
	var stackID *string
	err := d.db.QueryRowContext(ctx, "SELECT stackID FROM assets WHERE userID = ? AND immichID = ?", userID, immichID).Scan(&stackID)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return stackID, nil
}

func (d *Database) getStackMemberIDs(ctx context.Context, userID, stackID string) ([]string, error) {
	rows, err := d.db.QueryContext(ctx, "SELECT immichID FROM assets WHERE userID = ? AND stackID = ?", userID, stackID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

func (d *Database) bulkUpdateAssetLocation(ctx context.Context, userID string, immichIDs []string, lat, lon float64) error {
	if len(immichIDs) == 0 {
		return nil
	}

	placeholders := make([]string, len(immichIDs))
	args := []interface{}{lat, lon, userID}
	for i, id := range immichIDs {
		placeholders[i] = "?"
		args = append(args, id)
	}

	query := fmt.Sprintf(
		"UPDATE assets SET latitude = ?, longitude = ?, syncedAt = datetime('now') WHERE userID = ? AND immichID IN (%s)",
		strings.Join(placeholders, ","),
	)
	_, err := d.db.ExecContext(ctx, query, args...)
	return err
}

func (d *Database) isAssetInAlbum(ctx context.Context, userID, assetID, albumID string) (bool, error) {
	var exists bool
	err := d.db.QueryRowContext(ctx,
		"SELECT EXISTS(SELECT 1 FROM albumAssets WHERE userID = ? AND albumID = ? AND assetID = ?)",
		userID, albumID, assetID,
	).Scan(&exists)
	if err != nil {
		return false, err
	}
	return exists, nil
}

func (d *Database) deleteUserSyncData(ctx context.Context, userID string) error {
	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	tables := []string{
		"albumAssets",
		"albums",
		"frequentLocations",
		"assets",
		"syncState",
	}
	for _, table := range tables {
		if _, err := tx.ExecContext(ctx, "DELETE FROM "+table+" WHERE userID = ?", userID); err != nil {
			return fmt.Errorf("delete from %s: %w", table, err)
		}
	}

	return tx.Commit()
}

func (d *Database) close() error {
	return d.db.Close()
}

func scanAssetRows(rows *sql.Rows) ([]AssetRow, error) {
	var assets []AssetRow
	for rows.Next() {
		var a AssetRow
		if err := rows.Scan(
			&a.ImmichID, &a.Type, &a.OriginalFileName, &a.FileCreatedAt,
			&a.Latitude, &a.Longitude, &a.City, &a.State, &a.Country,
			&a.DateTimeOriginal, &a.SyncedAt, &a.StackID, &a.StackPrimaryAssetID, &a.StackAssetCount, &a.LibraryID,
		); err != nil {
			return nil, err
		}
		assets = append(assets, a)
	}
	return assets, rows.Err()
}
