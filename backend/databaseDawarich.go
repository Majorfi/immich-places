package main

import (
	"context"
	"fmt"
	"strings"
)

func (d *Database) upsertDawarichTracks(ctx context.Context, userID string, tracks []DawarichTrackRow) error {
	if len(tracks) == 0 {
		return nil
	}

	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx,
		`INSERT INTO dawarichTracks (ID, userID, name, startedAt, finishedAt, distance, duration, syncedAt)
		VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
		ON CONFLICT(userID, ID) DO UPDATE SET
			name = excluded.name,
			startedAt = excluded.startedAt,
			finishedAt = excluded.finishedAt,
			distance = excluded.distance,
			duration = excluded.duration,
			syncedAt = excluded.syncedAt`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, t := range tracks {
		if _, err := stmt.ExecContext(ctx, t.ID, userID, t.Name, t.StartedAt, t.FinishedAt, t.Distance, t.Duration); err != nil {
			return fmt.Errorf("upsert track %d: %w", t.ID, err)
		}
	}

	return tx.Commit()
}

func (d *Database) replaceDawarichTrackPoints(ctx context.Context, userID string, trackID int, points []DawarichTrackPointRow) error {
	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, "DELETE FROM dawarichTrackPoints WHERE userID = ? AND trackID = ?", userID, trackID); err != nil {
		return fmt.Errorf("delete existing points: %w", err)
	}

	for i := 0; i < len(points); i += sqliteChunkSize {
		end := i + sqliteChunkSize
		if end > len(points) {
			end = len(points)
		}
		chunk := points[i:end]

		placeholders := make([]string, len(chunk))
		args := make([]interface{}, 0, len(chunk)*6)
		for j, p := range chunk {
			placeholders[j] = "(?, ?, ?, ?, ?, ?)"
			args = append(args, userID, trackID, p.Timestamp, p.Latitude, p.Longitude, p.Altitude)
		}

		query := "INSERT INTO dawarichTrackPoints (userID, trackID, timestamp, latitude, longitude, altitude) VALUES " +
			strings.Join(placeholders, ",")
		if _, err := tx.ExecContext(ctx, query, args...); err != nil {
			return fmt.Errorf("insert points chunk at offset %d: %w", i, err)
		}
	}

	return tx.Commit()
}

func (d *Database) getDawarichTracks(ctx context.Context, userID string) ([]DawarichTrackRow, error) {
	rows, err := d.db.QueryContext(ctx,
		"SELECT ID, name, startedAt, finishedAt, distance, duration, syncedAt FROM dawarichTracks WHERE userID = ? ORDER BY startedAt DESC",
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tracks []DawarichTrackRow
	for rows.Next() {
		var t DawarichTrackRow
		if err := rows.Scan(&t.ID, &t.Name, &t.StartedAt, &t.FinishedAt, &t.Distance, &t.Duration, &t.SyncedAt); err != nil {
			return nil, err
		}
		tracks = append(tracks, t)
	}
	return tracks, rows.Err()
}

func (d *Database) getDawarichTrackPoints(ctx context.Context, userID string, trackIDs []int) (map[int][]DawarichTrackPointRow, error) {
	if len(trackIDs) == 0 {
		return make(map[int][]DawarichTrackPointRow), nil
	}

	placeholders := make([]string, len(trackIDs))
	args := []interface{}{userID}
	for i, id := range trackIDs {
		placeholders[i] = "?"
		args = append(args, id)
	}

	query := fmt.Sprintf(
		"SELECT trackID, timestamp, latitude, longitude, altitude FROM dawarichTrackPoints WHERE userID = ? AND trackID IN (%s) ORDER BY trackID, timestamp ASC",
		strings.Join(placeholders, ","),
	)

	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[int][]DawarichTrackPointRow)
	for rows.Next() {
		var p DawarichTrackPointRow
		if err := rows.Scan(&p.TrackID, &p.Timestamp, &p.Latitude, &p.Longitude, &p.Altitude); err != nil {
			return nil, err
		}
		result[p.TrackID] = append(result[p.TrackID], p)
	}
	return result, rows.Err()
}

func (d *Database) deleteDawarichData(ctx context.Context, userID string) error {
	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, "DELETE FROM dawarichTrackPoints WHERE userID = ?", userID); err != nil {
		return fmt.Errorf("delete dawarich track points: %w", err)
	}
	if _, err := tx.ExecContext(ctx, "DELETE FROM dawarichTracks WHERE userID = ?", userID); err != nil {
		return fmt.Errorf("delete dawarich tracks: %w", err)
	}
	if _, err := tx.ExecContext(ctx, "DELETE FROM syncState WHERE userID = ? AND key LIKE 'lastDawarich%'", userID); err != nil {
		return fmt.Errorf("delete dawarich sync state: %w", err)
	}

	return tx.Commit()
}

func (d *Database) deleteDawarichTracksNotIn(ctx context.Context, userID string, trackIDs []int) error {
	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if len(trackIDs) == 0 {
		if _, err := tx.ExecContext(ctx, "DELETE FROM dawarichTrackPoints WHERE userID = ?", userID); err != nil {
			return fmt.Errorf("delete orphaned track points: %w", err)
		}
		if _, err := tx.ExecContext(ctx, "DELETE FROM dawarichTracks WHERE userID = ?", userID); err != nil {
			return fmt.Errorf("delete stale tracks: %w", err)
		}
		return tx.Commit()
	}

	placeholders := make([]string, len(trackIDs))
	args := []interface{}{userID}
	for i, id := range trackIDs {
		placeholders[i] = "?"
		args = append(args, id)
	}
	notInClause := strings.Join(placeholders, ",")

	pointsQuery := fmt.Sprintf("DELETE FROM dawarichTrackPoints WHERE userID = ? AND trackID NOT IN (%s)", notInClause)
	if _, err := tx.ExecContext(ctx, pointsQuery, args...); err != nil {
		return fmt.Errorf("delete orphaned track points: %w", err)
	}

	tracksQuery := fmt.Sprintf("DELETE FROM dawarichTracks WHERE userID = ? AND ID NOT IN (%s)", notInClause)
	if _, err := tx.ExecContext(ctx, tracksQuery, args...); err != nil {
		return fmt.Errorf("delete stale tracks: %w", err)
	}

	return tx.Commit()
}
