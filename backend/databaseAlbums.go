package main

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
)

func (d *Database) getAlbumUpdatedAt(ctx context.Context, userID, albumID string) (string, error) {
	var updatedAt string
	err := d.db.QueryRowContext(ctx, "SELECT updatedAt FROM albums WHERE userID = ? AND immichID = ?", userID, albumID).Scan(&updatedAt)
	return updatedAt, err
}

func (d *Database) getAlbumUpdatedAtMap(ctx context.Context, userID string) (map[string]string, error) {
	result := make(map[string]string)
	rows, err := d.db.QueryContext(ctx, "SELECT immichID, updatedAt FROM albums WHERE userID = ?", userID)
	if err != nil {
		return nil, fmt.Errorf("failed to query album updatedAt: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var id, updatedAt string
		if err := rows.Scan(&id, &updatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan album updatedAt: %w", err)
		}
		result[id] = updatedAt
	}
	return result, rows.Err()
}

func (d *Database) upsertAlbum(ctx context.Context, userID, albumID, albumName string, thumbnailAssetID *string, assetCount int, updatedAt string, startDate *string) error {
	_, err := d.db.ExecContext(ctx,
		`INSERT INTO albums (immichID, userID, albumName, thumbnailAssetID, assetCount, updatedAt, startDate)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(userID, immichID) DO UPDATE SET
			albumName = excluded.albumName,
			thumbnailAssetID = excluded.thumbnailAssetID,
			assetCount = excluded.assetCount,
			updatedAt = excluded.updatedAt,
			startDate = excluded.startDate`,
		albumID, userID, albumName, thumbnailAssetID, assetCount, updatedAt, startDate,
	)
	return err
}

func (d *Database) replaceAlbumAssets(ctx context.Context, userID, albumID string, assetIDs []string) error {
	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if err := bulkInsertTemp(ctx, tx, "tmpDesiredAssets", assetIDs); err != nil {
		return fmt.Errorf("populate temp table: %w", err)
	}

	if _, err := tx.ExecContext(ctx,
		`DELETE FROM albumAssets WHERE userID = ? AND albumID = ? AND assetID NOT IN (SELECT val FROM tmpDesiredAssets)`,
		userID, albumID,
	); err != nil {
		return fmt.Errorf("delete stale album assets: %w", err)
	}

	if _, err := tx.ExecContext(ctx,
		`INSERT INTO albumAssets (userID, albumID, assetID)
		SELECT ?, ?, val FROM tmpDesiredAssets
		WHERE val NOT IN (SELECT assetID FROM albumAssets WHERE userID = ? AND albumID = ?)`,
		userID, albumID, userID, albumID,
	); err != nil {
		return fmt.Errorf("insert new album assets: %w", err)
	}

	tx.ExecContext(ctx, "DROP TABLE IF EXISTS tmpDesiredAssets")
	return tx.Commit()
}

func (d *Database) getAlbumsWithNoGPSCount(ctx context.Context, userID string) ([]AlbumRow, error) {
	rows, err := d.db.QueryContext(ctx,
		`SELECT a.immichID, a.albumName, a.thumbnailAssetID, a.assetCount, a.updatedAt, a.startDate,
			COUNT(CASE WHEN ast.immichID IS NOT NULL
				AND (ast.latitude IS NULL OR ast.longitude IS NULL)
				AND ast.stackPrimaryAssetID IS NULL`+hiddenLibraryFilterAliasedAST+` THEN 1 END) as filteredCount
		FROM albums a
		LEFT JOIN albumAssets aa ON aa.userID = a.userID AND aa.albumID = a.immichID
		LEFT JOIN assets ast ON ast.userID = a.userID AND ast.immichID = aa.assetID
		WHERE a.userID = ?
		GROUP BY a.immichID
		ORDER BY a.startDate DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var albums []AlbumRow
	for rows.Next() {
		var a AlbumRow
		if err := rows.Scan(&a.ImmichID, &a.AlbumName, &a.ThumbnailAssetID, &a.AssetCount, &a.UpdatedAt, &a.StartDate, &a.FilteredCount); err != nil {
			return nil, err
		}
		a.NoGPSCount = a.FilteredCount
		albums = append(albums, a)
	}
	return albums, rows.Err()
}

func (d *Database) getAlbumsWithGPSCount(ctx context.Context, userID string) ([]AlbumRow, error) {
	rows, err := d.db.QueryContext(ctx,
		`SELECT a.immichID, a.albumName, a.thumbnailAssetID, a.assetCount, a.updatedAt, a.startDate,
			COUNT(CASE WHEN ast.latitude IS NOT NULL AND ast.longitude IS NOT NULL
				AND ast.stackPrimaryAssetID IS NULL`+hiddenLibraryFilterAliasedAST+` THEN 1 END) as filteredCount,
			COUNT(CASE WHEN (ast.latitude IS NULL OR ast.longitude IS NULL)
				AND ast.stackPrimaryAssetID IS NULL`+hiddenLibraryFilterAliasedAST+` THEN 1 END) as noGPSCount
		FROM albums a
		JOIN albumAssets aa ON aa.userID = a.userID AND aa.albumID = a.immichID
		JOIN assets ast ON ast.userID = a.userID AND ast.immichID = aa.assetID
		WHERE a.userID = ?
		GROUP BY a.immichID
		HAVING filteredCount > 0
		ORDER BY a.startDate DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var albums []AlbumRow
	for rows.Next() {
		var a AlbumRow
		if err := rows.Scan(&a.ImmichID, &a.AlbumName, &a.ThumbnailAssetID, &a.AssetCount, &a.UpdatedAt, &a.StartDate, &a.FilteredCount, &a.NoGPSCount); err != nil {
			return nil, err
		}
		albums = append(albums, a)
	}
	return albums, rows.Err()
}

func (d *Database) getGeolocatedAssetsByAlbum(ctx context.Context, userID, albumID string) ([]AssetRow, error) {
	rows, err := d.db.QueryContext(ctx,
		`SELECT `+assetColumnsAliased+`
		FROM assets a
		JOIN albumAssets aa ON aa.userID = a.userID AND aa.assetID = a.immichID
		WHERE a.userID = ? AND aa.albumID = ? AND a.latitude IS NOT NULL AND a.longitude IS NOT NULL
			AND a.stackPrimaryAssetID IS NULL`+hiddenLibraryFilterAliased,
		userID, albumID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanAssetRows(rows)
}

func (d *Database) deleteAlbumsNotIn(ctx context.Context, userID string, albumIDs []string) error {
	if len(albumIDs) == 0 {
		_, err := d.db.ExecContext(ctx, "DELETE FROM albums WHERE userID = ?", userID)
		return err
	}

	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if err := bulkInsertTemp(ctx, tx, "tmpKeepAlbums", albumIDs); err != nil {
		return fmt.Errorf("populate temp table: %w", err)
	}

	if _, err := tx.ExecContext(ctx, "DELETE FROM albums WHERE userID = ? AND immichID NOT IN (SELECT val FROM tmpKeepAlbums)", userID); err != nil {
		return fmt.Errorf("delete stale albums: %w", err)
	}

	tx.ExecContext(ctx, "DROP TABLE IF EXISTS tmpKeepAlbums")
	return tx.Commit()
}

func bulkInsertTemp(ctx context.Context, tx *sql.Tx, tableName string, values []string) error {
	if _, err := tx.ExecContext(ctx, fmt.Sprintf("CREATE TEMP TABLE %s (val TEXT NOT NULL)", tableName)); err != nil {
		return err
	}

	for i := 0; i < len(values); i += sqliteChunkSize {
		end := i + sqliteChunkSize
		if end > len(values) {
			end = len(values)
		}
		chunk := values[i:end]

		placeholders := make([]string, len(chunk))
		args := make([]interface{}, len(chunk))
		for j, v := range chunk {
			placeholders[j] = "(?)"
			args[j] = v
		}

		query := fmt.Sprintf("INSERT INTO %s (val) VALUES %s", tableName, strings.Join(placeholders, ","))
		if _, err := tx.ExecContext(ctx, query, args...); err != nil {
			return err
		}
	}

	return nil
}
