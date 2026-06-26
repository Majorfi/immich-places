package main

import (
	"context"
	"fmt"
)

func (d *Database) getTagUpdatedAtMap(ctx context.Context, userID string) (map[string]string, error) {
	result := make(map[string]string)
	rows, err := d.db.QueryContext(ctx, "SELECT immichID, updatedAt FROM tags WHERE userID = ?", userID)
	if err != nil {
		return nil, fmt.Errorf("failed to query tag updatedAt: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var id, updatedAt string
		if err := rows.Scan(&id, &updatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan tag updatedAt: %w", err)
		}
		result[id] = updatedAt
	}
	return result, rows.Err()
}

func (d *Database) upsertTag(ctx context.Context, userID, tagID, name, value string, parentID, color *string) error {
	_, err := d.db.ExecContext(ctx,
		`INSERT INTO tags (userID, immichID, name, value, parentID, color, updatedAt)
		VALUES (?, ?, ?, ?, ?, ?, '')
		ON CONFLICT(userID, immichID) DO UPDATE SET
			name = excluded.name,
			value = excluded.value,
			parentID = excluded.parentID,
			color = excluded.color`,
		userID, tagID, name, value, parentID, color,
	)
	return err
}

func (d *Database) setTagSynced(ctx context.Context, userID, tagID, updatedAt string) error {
	_, err := d.db.ExecContext(ctx,
		`UPDATE tags SET updatedAt = ? WHERE userID = ? AND immichID = ?`,
		updatedAt, userID, tagID,
	)
	return err
}

func (d *Database) replaceTagAssets(ctx context.Context, userID, tagID string, assetIDs []string) error {
	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if err := bulkInsertTemp(ctx, tx, "tmpDesiredTagAssets", assetIDs); err != nil {
		return fmt.Errorf("populate temp table: %w", err)
	}

	if _, err := tx.ExecContext(ctx,
		`DELETE FROM assetTags WHERE userID = ? AND tagID = ? AND assetID NOT IN (SELECT val FROM tmpDesiredTagAssets)`,
		userID, tagID,
	); err != nil {
		return fmt.Errorf("delete stale tag assets: %w", err)
	}

	if _, err := tx.ExecContext(ctx,
		`INSERT INTO assetTags (userID, tagID, assetID)
		SELECT ?, ?, val FROM tmpDesiredTagAssets
		WHERE val NOT IN (SELECT assetID FROM assetTags WHERE userID = ? AND tagID = ?)`,
		userID, tagID, userID, tagID,
	); err != nil {
		return fmt.Errorf("insert new tag assets: %w", err)
	}

	tx.ExecContext(ctx, "DROP TABLE IF EXISTS tmpDesiredTagAssets")
	return tx.Commit()
}

func (d *Database) deleteTagsNotIn(ctx context.Context, userID string, tagIDs []string) error {
	if len(tagIDs) == 0 {
		_, err := d.db.ExecContext(ctx, "DELETE FROM tags WHERE userID = ?", userID)
		return err
	}

	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if err := bulkInsertTemp(ctx, tx, "tmpKeepTags", tagIDs); err != nil {
		return fmt.Errorf("populate temp table: %w", err)
	}

	if _, err := tx.ExecContext(ctx, "DELETE FROM tags WHERE userID = ? AND immichID NOT IN (SELECT val FROM tmpKeepTags)", userID); err != nil {
		return fmt.Errorf("delete stale tags: %w", err)
	}

	tx.ExecContext(ctx, "DROP TABLE IF EXISTS tmpKeepTags")
	return tx.Commit()
}

func (d *Database) getTags(ctx context.Context, userID string) ([]TagRow, error) {
	rows, err := d.db.QueryContext(ctx,
		`SELECT t.immichID, t.name, t.value, t.parentID, t.color, COUNT(a.immichID) AS assetCount
		FROM tags t
		LEFT JOIN assetTags at ON at.userID = t.userID AND at.tagID = t.immichID
		LEFT JOIN assets a ON a.userID = at.userID AND a.immichID = at.assetID
			AND a.stackPrimaryAssetID IS NULL`+hiddenLibraryFilterAliased+`
		WHERE t.userID = ?
		GROUP BY t.immichID
		ORDER BY t.value ASC`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query tags: %w", err)
	}
	defer rows.Close()

	var tags []TagRow
	for rows.Next() {
		var t TagRow
		if err := rows.Scan(&t.ImmichID, &t.Name, &t.Value, &t.ParentID, &t.Color, &t.AssetCount); err != nil {
			return nil, fmt.Errorf("failed to scan tag: %w", err)
		}
		tags = append(tags, t)
	}
	return tags, rows.Err()
}
