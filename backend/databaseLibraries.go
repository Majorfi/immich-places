package main

import (
	"context"
	"fmt"
	"strings"
)

func (d *Database) upsertLibrary(ctx context.Context, libraryID, name string, assetCount int) error {
	_, err := d.db.ExecContext(ctx,
		`INSERT INTO libraries (libraryID, name, assetCount, syncedAt)
		VALUES (?, ?, ?, datetime('now'))
		ON CONFLICT(libraryID) DO UPDATE SET
			name = excluded.name,
			assetCount = excluded.assetCount,
			syncedAt = datetime('now')`,
		libraryID, name, assetCount,
	)
	return err
}

func (d *Database) getLibraries(ctx context.Context) ([]LibraryRow, error) {
	rows, err := d.db.QueryContext(ctx,
		`SELECT l.libraryID, l.name, COALESCE(a.cnt, 0), l.isHidden, l.syncedAt
			FROM libraries l
		LEFT JOIN (
			SELECT libraryID, COUNT(*) AS cnt
			FROM assets WHERE libraryID IS NOT NULL
			GROUP BY libraryID
		) a ON a.libraryID = l.libraryID
		ORDER BY l.name`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var libraries []LibraryRow
	for rows.Next() {
		var l LibraryRow
		var isHidden int
		if err := rows.Scan(&l.LibraryID, &l.Name, &l.AssetCount, &isHidden, &l.SyncedAt); err != nil {
			return nil, err
		}
		l.IsHidden = isHidden == 1
		libraries = append(libraries, l)
	}
	return libraries, rows.Err()
}

func (d *Database) updateLibraryVisibility(ctx context.Context, libraryID string, isHidden bool) error {
	hiddenInt := 0
	if isHidden {
		hiddenInt = 1
	}
	result, err := d.db.ExecContext(ctx,
		"UPDATE libraries SET isHidden = ? WHERE libraryID = ?",
		hiddenInt, libraryID,
	)
	if err != nil {
		return err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return fmt.Errorf("library not found")
	}
	return nil
}

func (d *Database) deleteLibrariesNotIn(ctx context.Context, libraryIDs []string) error {
	if len(libraryIDs) == 0 {
		_, err := d.db.ExecContext(ctx,
			`DELETE FROM libraries
			WHERE libraryID NOT IN (
				SELECT DISTINCT libraryID FROM assets WHERE libraryID IS NOT NULL
			)`,
		)
		return err
	}

	placeholders := make([]string, len(libraryIDs))
	args := make([]interface{}, 0, len(libraryIDs))
	for i, libraryID := range libraryIDs {
		placeholders[i] = "?"
		args = append(args, libraryID)
	}

	query := fmt.Sprintf(
		`DELETE FROM libraries
		WHERE libraryID NOT IN (%s)
			AND libraryID NOT IN (
				SELECT DISTINCT libraryID FROM assets WHERE libraryID IS NOT NULL
			)`,
		strings.Join(placeholders, ","),
	)
	_, err := d.db.ExecContext(ctx, query, args...)
	return err
}

func (d *Database) needsLibraryIDBackfill(ctx context.Context, userID string) (bool, error) {
	backfillDone, err := d.getSyncState(ctx, userID, "libraryIDBackfillDone")
	if err != nil {
		return false, err
	}
	if backfillDone != nil && *backfillDone == "true" {
		return false, nil
	}

	hasLibraryAccess, err := d.getSyncState(ctx, userID, "hasLibraryAccess")
	if err != nil {
		return false, err
	}
	if hasLibraryAccess == nil || *hasLibraryAccess != "true" {
		return false, nil
	}

	var hasLibraries bool
	err = d.db.QueryRowContext(ctx,
		"SELECT EXISTS(SELECT 1 FROM libraries)",
	).Scan(&hasLibraries)
	if err != nil {
		return false, err
	}
	if !hasLibraries {
		return false, nil
	}

	var hasAssets bool
	err = d.db.QueryRowContext(ctx,
		"SELECT EXISTS(SELECT 1 FROM assets WHERE userID = ?)", userID,
	).Scan(&hasAssets)
	if err != nil {
		return false, err
	}
	if !hasAssets {
		return false, nil
	}

	var hasUntaggedAssets bool
	err = d.db.QueryRowContext(ctx,
		"SELECT EXISTS(SELECT 1 FROM assets WHERE userID = ? AND libraryID IS NULL)", userID,
	).Scan(&hasUntaggedAssets)
	if err != nil {
		return false, err
	}

	return hasUntaggedAssets, nil
}

func (d *Database) getHiddenLibraryIDs(ctx context.Context) ([]string, error) {
	rows, err := d.db.QueryContext(ctx,
		"SELECT libraryID FROM libraries WHERE isHidden = 1",
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var libraryIDs []string
	for rows.Next() {
		var libraryID string
		if err := rows.Scan(&libraryID); err != nil {
			return nil, err
		}
		libraryIDs = append(libraryIDs, libraryID)
	}
	return libraryIDs, rows.Err()
}
