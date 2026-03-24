package main

import (
	"context"
	"testing"
	"time"
)

const testUserID = "test-user-id"

func newTestDB(t *testing.T) *Database {
	t.Helper()
	db, err := newDatabase(t.TempDir(), "test-encryption-key")
	if err != nil {
		t.Fatalf("failed to create test database: %v", err)
	}
	t.Cleanup(func() { db.close() })
	if err := db.createUser(context.Background(), testUserID, "test@example.com", "hashed"); err != nil {
		t.Fatalf("failed to seed test user: %v", err)
	}
	return db
}

func ptr[T any](v T) *T { return &v }

func seedAsset(t *testing.T, db *Database, id string, lat, lon *float64, fileCreatedAt string) {
	t.Helper()
	err := db.upsertAssets(context.Background(), testUserID, []AssetRow{{
		ImmichID:         id,
		Type:             "IMAGE",
		OriginalFileName: id + ".jpg",
		FileCreatedAt:    fileCreatedAt,
		Latitude:         lat,
		Longitude:        lon,
	}})
	if err != nil {
		t.Fatalf("failed to seed asset %s: %v", id, err)
	}
}

func TestUpsertAndCountAssets(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	seedAsset(t, db, "a1", ptr(48.85), ptr(2.35), "2024-01-01T12:00:00Z")
	seedAsset(t, db, "a2", nil, nil, "2024-01-02T12:00:00Z")
	seedAsset(t, db, "a3", ptr(40.71), ptr(-74.0), "2024-01-03T12:00:00Z")

	total, err := db.countAssets(ctx, testUserID)
	if err != nil {
		t.Fatalf("countAssets: %v", err)
	}
	if total != 3 {
		t.Errorf("expected 3 total, got %d", total)
	}

	withGPS, err := db.countFilteredAssets(ctx, testUserID, "", true, "all", "", "")
	if err != nil {
		t.Fatalf("countFilteredAssets: %v", err)
	}
	if withGPS != 2 {
		t.Errorf("expected 2 with GPS, got %d", withGPS)
	}

	noGPS, _ := db.countNoGPSAssets(ctx, testUserID)
	if noGPS != 1 {
		t.Errorf("expected 1 no GPS, got %d", noGPS)
	}
}

func TestUpsertOverwritesExisting(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	seedAsset(t, db, "a1", nil, nil, "2024-01-01T12:00:00Z")
	seedAsset(t, db, "a1", ptr(48.85), ptr(2.35), "2024-01-01T12:00:00Z")

	total, _ := db.countAssets(ctx, testUserID)
	if total != 1 {
		t.Errorf("expected 1 after upsert, got %d", total)
	}
	withGPS, err := db.countFilteredAssets(ctx, testUserID, "", true, "all", "", "")
	if err != nil {
		t.Fatalf("countFilteredAssets: %v", err)
	}
	if withGPS != 1 {
		t.Errorf("expected 1 with GPS after upsert, got %d", withGPS)
	}
}

func TestUpdateAssetHidden(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	seedAsset(t, db, "a1", ptr(48.85), ptr(2.35), "2024-01-01T12:00:00Z")
	seedAsset(t, db, "a2", ptr(40.71), ptr(-74.0), "2024-01-02T12:00:00Z")

	visible, err := db.countFilteredAssets(ctx, testUserID, "", true, "visible", "", "")
	if err != nil {
		t.Fatalf("countFilteredAssets visible: %v", err)
	}
	if visible != 2 {
		t.Errorf("expected 2 visible, got %d", visible)
	}

	err = db.updateAssetHidden(ctx, testUserID, "a1", true)
	if err != nil {
		t.Fatalf("updateAssetHidden: %v", err)
	}

	visible, err = db.countFilteredAssets(ctx, testUserID, "", true, "visible", "", "")
	if err != nil {
		t.Fatalf("countFilteredAssets visible: %v", err)
	}
	if visible != 1 {
		t.Errorf("expected 1 visible after hiding, got %d", visible)
	}

	hidden, err := db.countFilteredAssets(ctx, testUserID, "", true, "hidden", "", "")
	if err != nil {
		t.Fatalf("countFilteredAssets hidden: %v", err)
	}
	if hidden != 1 {
		t.Errorf("expected 1 hidden, got %d", hidden)
	}

	all, err := db.countFilteredAssets(ctx, testUserID, "", true, "all", "", "")
	if err != nil {
		t.Fatalf("countFilteredAssets all: %v", err)
	}
	if all != 2 {
		t.Errorf("expected 2 total, got %d", all)
	}

	err = db.updateAssetHidden(ctx, testUserID, "a1", false)
	if err != nil {
		t.Fatalf("updateAssetHidden unhide: %v", err)
	}

	visible, err = db.countFilteredAssets(ctx, testUserID, "", true, "visible", "", "")
	if err != nil {
		t.Fatalf("countFilteredAssets visible: %v", err)
	}
	if visible != 2 {
		t.Errorf("expected 2 visible after unhiding, got %d", visible)
	}

	err = db.updateAssetHidden(ctx, testUserID, "nonexistent", true)
	if err == nil {
		t.Error("expected error for nonexistent asset")
	}
}

func TestHiddenFilterDoesNotAffectMapMarkers(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	seedAsset(t, db, "a1", ptr(48.85), ptr(2.35), "2024-01-01T12:00:00Z")
	seedAsset(t, db, "a2", ptr(40.71), ptr(-74.0), "2024-01-02T12:00:00Z")

	if err := db.updateAssetHidden(ctx, testUserID, "a1", true); err != nil {
		t.Fatalf("updateAssetHidden: %v", err)
	}

	markers, err := db.getMapMarkers(ctx, testUserID, "", nil, maxMapMarkers)
	if err != nil {
		t.Fatalf("getMapMarkers: %v", err)
	}
	if len(markers) != 2 {
		t.Errorf("expected 2 markers (hidden assets still show on map), got %d", len(markers))
	}
}

func TestIsHiddenSurvivesUpsert(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	seedAsset(t, db, "a1", ptr(48.85), ptr(2.35), "2024-01-01T12:00:00Z")

	if err := db.updateAssetHidden(ctx, testUserID, "a1", true); err != nil {
		t.Fatalf("updateAssetHidden: %v", err)
	}

	hidden, err := db.countFilteredAssets(ctx, testUserID, "", true, "hidden", "", "")
	if err != nil {
		t.Fatalf("countFilteredAssets hidden: %v", err)
	}
	if hidden != 1 {
		t.Fatalf("expected 1 hidden before upsert, got %d", hidden)
	}

	if err := db.upsertAssets(ctx, testUserID, []AssetRow{{
		ImmichID:         "a1",
		Type:             "IMAGE",
		OriginalFileName: "photo.jpg",
		FileCreatedAt:    "2024-01-01T12:00:00Z",
		Latitude:         ptr(48.85),
		Longitude:        ptr(2.35),
	}}); err != nil {
		t.Fatalf("upsertAssets: %v", err)
	}

	hidden, err = db.countFilteredAssets(ctx, testUserID, "", true, "hidden", "", "")
	if err != nil {
		t.Fatalf("countFilteredAssets hidden: %v", err)
	}
	if hidden != 1 {
		t.Errorf("expected isHidden to survive upsert, got %d hidden", hidden)
	}
}

func TestGetMapMarkersNoBounds(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	seedAsset(t, db, "a1", ptr(48.85), ptr(2.35), "2024-01-01T12:00:00Z")
	seedAsset(t, db, "a2", ptr(40.71), ptr(-74.0), "2024-01-02T12:00:00Z")
	seedAsset(t, db, "a3", nil, nil, "2024-01-03T12:00:00Z")

	markers, err := db.getMapMarkers(ctx, testUserID, "", nil, maxMapMarkers)
	if err != nil {
		t.Fatalf("getMapMarkers: %v", err)
	}
	if len(markers) != 2 {
		t.Errorf("expected 2 markers, got %d", len(markers))
	}
}

func TestGetMapMarkersRespectsLimit(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	seedAsset(t, db, "a1", ptr(48.85), ptr(2.35), "2024-01-01T12:00:00Z")
	seedAsset(t, db, "a2", ptr(40.71), ptr(-74.0), "2024-01-02T12:00:00Z")

	markers, err := db.getMapMarkers(ctx, testUserID, "", nil, 1)
	if err != nil {
		t.Fatalf("getMapMarkers with limit: %v", err)
	}
	if len(markers) != 1 {
		t.Errorf("expected 1 marker when limit=1, got %d", len(markers))
	}
	if len(markers) == 1 && markers[0].ImmichID != "a2" {
		t.Errorf("expected latest marker a2, got %s", markers[0].ImmichID)
	}
}

func TestCountMapMarkers(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	seedAsset(t, db, "a1", ptr(48.85), ptr(2.35), "2024-01-01T12:00:00Z")
	seedAsset(t, db, "a2", ptr(40.71), ptr(-74.0), "2024-01-02T12:00:00Z")
	seedAsset(t, db, "a3", nil, nil, "2024-01-03T12:00:00Z")

	count, err := db.countMapMarkers(ctx, testUserID, "", nil)
	if err != nil {
		t.Fatalf("countMapMarkers: %v", err)
	}
	if count != 2 {
		t.Errorf("expected map marker count 2, got %d", count)
	}
}

func TestGetMapMarkersWithBounds(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	seedAsset(t, db, "paris", ptr(48.85), ptr(2.35), "2024-01-01T12:00:00Z")
	seedAsset(t, db, "nyc", ptr(40.71), ptr(-74.0), "2024-01-02T12:00:00Z")

	bounds := &TViewportBounds{North: 50, South: 45, East: 10, West: -5}
	markers, err := db.getMapMarkers(ctx, testUserID, "", bounds, maxMapMarkers)
	if err != nil {
		t.Fatalf("getMapMarkers with bounds: %v", err)
	}
	if len(markers) != 1 {
		t.Fatalf("expected 1 marker within bounds, got %d", len(markers))
	}
	if markers[0].ImmichID != "paris" {
		t.Errorf("expected paris marker, got %s", markers[0].ImmichID)
	}
}

func TestGetMapMarkersDatelineCrossing(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	seedAsset(t, db, "fiji", ptr(-17.77), ptr(178.0), "2024-01-01T12:00:00Z")
	seedAsset(t, db, "samoa", ptr(-13.76), ptr(-172.1), "2024-01-02T12:00:00Z")
	seedAsset(t, db, "paris", ptr(48.85), ptr(2.35), "2024-01-03T12:00:00Z")

	bounds := &TViewportBounds{North: -10, South: -20, East: -170, West: 170}
	markers, err := db.getMapMarkers(ctx, testUserID, "", bounds, maxMapMarkers)
	if err != nil {
		t.Fatalf("getMapMarkers dateline: %v", err)
	}
	if len(markers) != 2 {
		t.Errorf("expected 2 markers across dateline (fiji + samoa), got %d", len(markers))
	}

	markerIDs := make(map[string]bool)
	for _, m := range markers {
		markerIDs[m.ImmichID] = true
	}
	if !markerIDs["fiji"] || !markerIDs["samoa"] {
		t.Errorf("expected fiji and samoa, got %v", markerIDs)
	}
}

func TestBulkUpdateAssetLocation(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	seedAsset(t, db, "a1", nil, nil, "2024-01-01T12:00:00Z")
	seedAsset(t, db, "a2", nil, nil, "2024-01-02T12:00:00Z")

	err := db.bulkUpdateAssetLocation(ctx, testUserID, []string{"a1", "a2"}, 51.5, -0.12)
	if err != nil {
		t.Fatalf("bulkUpdateAssetLocation: %v", err)
	}

	withGPS, err := db.countFilteredAssets(ctx, testUserID, "", true, "all", "", "")
	if err != nil {
		t.Fatalf("countFilteredAssets: %v", err)
	}
	if withGPS != 2 {
		t.Errorf("expected 2 with GPS after bulk update, got %d", withGPS)
	}
}

func TestBulkUpdateAssetLocationNullIsland(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	seedAsset(t, db, "a1", ptr(48.85), ptr(2.35), "2024-01-01T12:00:00Z")

	withGPS, err := db.countFilteredAssets(ctx, testUserID, "", true, "all", "", "")
	if err != nil {
		t.Fatalf("countFilteredAssets before: %v", err)
	}
	if withGPS != 1 {
		t.Fatalf("expected 1 with GPS before null island update, got %d", withGPS)
	}

	err = db.bulkUpdateAssetLocation(ctx, testUserID, []string{"a1"}, 0, 0)
	if err != nil {
		t.Fatalf("bulkUpdateAssetLocation: %v", err)
	}

	withGPS, err = db.countFilteredAssets(ctx, testUserID, "", true, "all", "", "")
	if err != nil {
		t.Fatalf("countFilteredAssets after: %v", err)
	}
	if withGPS != 0 {
		t.Errorf("expected 0 with GPS after null island update, got %d", withGPS)
	}
}

func TestBulkUpdateAssetHidden(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	seedAsset(t, db, "a1", ptr(48.85), ptr(2.35), "2024-01-01T12:00:00Z")
	seedAsset(t, db, "a2", ptr(40.71), ptr(-74.0), "2024-01-02T12:00:00Z")
	seedAsset(t, db, "a3", ptr(35.68), ptr(139.69), "2024-01-03T12:00:00Z")

	err := db.bulkUpdateAssetHidden(ctx, testUserID, []string{"a1", "a2"}, true)
	if err != nil {
		t.Fatalf("bulkUpdateAssetHidden: %v", err)
	}

	hidden, err := db.countFilteredAssets(ctx, testUserID, "", true, "hidden", "", "")
	if err != nil {
		t.Fatalf("countFilteredAssets hidden: %v", err)
	}
	if hidden != 2 {
		t.Errorf("expected 2 hidden after bulk hide, got %d", hidden)
	}

	visible, err := db.countFilteredAssets(ctx, testUserID, "", true, "visible", "", "")
	if err != nil {
		t.Fatalf("countFilteredAssets visible: %v", err)
	}
	if visible != 1 {
		t.Errorf("expected 1 visible after bulk hide, got %d", visible)
	}

	err = db.bulkUpdateAssetHidden(ctx, testUserID, []string{"a1", "a2"}, false)
	if err != nil {
		t.Fatalf("bulkUpdateAssetHidden unhide: %v", err)
	}

	visible, err = db.countFilteredAssets(ctx, testUserID, "", true, "visible", "", "")
	if err != nil {
		t.Fatalf("countFilteredAssets visible after unhide: %v", err)
	}
	if visible != 3 {
		t.Errorf("expected 3 visible after bulk unhide, got %d", visible)
	}

	err = db.bulkUpdateAssetHidden(ctx, testUserID, []string{}, true)
	if err != nil {
		t.Fatalf("bulkUpdateAssetHidden empty: %v", err)
	}
}

func TestGetAssetPageInfoNotFound(t *testing.T) {
	db := newTestDB(t)

	_, err := db.getAssetPageInfo(context.Background(), testUserID, "nonexistent", "", 20)
	if err == nil {
		t.Fatal("expected error for nonexistent asset")
	}
}

func TestGetAssetPageInfoFound(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	seedAsset(t, db, "a1", ptr(48.85), ptr(2.35), "2024-01-01T12:00:00Z")
	seedAsset(t, db, "a2", ptr(40.71), ptr(-74.0), "2024-01-02T12:00:00Z")
	seedAsset(t, db, "a3", ptr(35.68), ptr(139.69), "2024-01-03T12:00:00Z")

	info, err := db.getAssetPageInfo(ctx, testUserID, "a2", "", 2)
	if err != nil {
		t.Fatalf("getAssetPageInfo: %v", err)
	}
	if info.Page < 1 {
		t.Errorf("expected page >= 1, got %d", info.Page)
	}
}

func TestGetSameDayAssetsRange(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	ref := "2024-06-15T12:00:00Z"
	nearby := time.Date(2024, 6, 15, 18, 0, 0, 0, time.UTC).Format(time.RFC3339)
	farAway := time.Date(2024, 1, 1, 12, 0, 0, 0, time.UTC).Format(time.RFC3339)

	db.upsertAssets(ctx, testUserID, []AssetRow{{
		ImmichID: "near", Type: "IMAGE", OriginalFileName: "near.jpg",
		FileCreatedAt: nearby, Latitude: ptr(48.85), Longitude: ptr(2.35),
		DateTimeOriginal: &nearby,
	}})
	db.upsertAssets(ctx, testUserID, []AssetRow{{
		ImmichID: "far", Type: "IMAGE", OriginalFileName: "far.jpg",
		FileCreatedAt: farAway, Latitude: ptr(40.71), Longitude: ptr(-74.0),
		DateTimeOriginal: &farAway,
	}})

	assets, err := db.getSameDayAssets(ctx, testUserID, ref, 12)
	if err != nil {
		t.Fatalf("getSameDayAssets: %v", err)
	}
	if len(assets) != 1 {
		t.Errorf("expected 1 asset within 12h, got %d", len(assets))
	}

	assets, err = db.getSameDayAssets(ctx, testUserID, ref, 168)
	if err != nil {
		t.Fatalf("getSameDayAssets 168h: %v", err)
	}
	if len(assets) != 1 {
		t.Errorf("expected 1 asset within 168h (far is 6 months away), got %d", len(assets))
	}
}

func TestAlbumDiffReplaceAssets(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	db.upsertAlbum(ctx, testUserID, "album1", "Test Album", nil, 3, "2024-01-01T00:00:00Z", nil)

	err := db.replaceAlbumAssets(ctx, testUserID, "album1", []string{"a1", "a2", "a3"})
	if err != nil {
		t.Fatalf("replaceAlbumAssets initial: %v", err)
	}

	err = db.replaceAlbumAssets(ctx, testUserID, "album1", []string{"a2", "a3", "a4"})
	if err != nil {
		t.Fatalf("replaceAlbumAssets update: %v", err)
	}

	rows, err := db.db.Query("SELECT assetID FROM albumAssets WHERE userID = ? AND albumID = ? ORDER BY assetID", testUserID, "album1")
	if err != nil {
		t.Fatalf("query album assets: %v", err)
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		rows.Scan(&id)
		ids = append(ids, id)
	}

	if len(ids) != 3 {
		t.Fatalf("expected 3 assets, got %d: %v", len(ids), ids)
	}
	expected := map[string]bool{"a2": true, "a3": true, "a4": true}
	for _, id := range ids {
		if !expected[id] {
			t.Errorf("unexpected asset %s", id)
		}
	}
}

func TestSyncState(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	val, err := db.getSyncState(ctx, testUserID, "lastSyncAt")
	if err != nil {
		t.Fatalf("getSyncState: %v", err)
	}
	if val != nil {
		t.Errorf("expected nil for unset key, got %v", val)
	}

	db.setSyncState(ctx, testUserID, "lastSyncAt", "2024-01-01T00:00:00Z")
	val, _ = db.getSyncState(ctx, testUserID, "lastSyncAt")
	if val == nil || *val != "2024-01-01T00:00:00Z" {
		t.Errorf("expected 2024-01-01T00:00:00Z, got %v", val)
	}

	db.setSyncState(ctx, testUserID, "lastSyncAt", "2024-06-01T00:00:00Z")
	val, _ = db.getSyncState(ctx, testUserID, "lastSyncAt")
	if val == nil || *val != "2024-06-01T00:00:00Z" {
		t.Errorf("expected updated value, got %v", val)
	}
}

func TestDeleteSyncState(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	db.setSyncState(ctx, testUserID, "lastSyncError", "some error")
	val, _ := db.getSyncState(ctx, testUserID, "lastSyncError")
	if val == nil {
		t.Fatal("expected value to exist before delete")
	}

	db.deleteSyncState(ctx, testUserID, "lastSyncError")
	val, _ = db.getSyncState(ctx, testUserID, "lastSyncError")
	if val != nil {
		t.Errorf("expected nil after delete, got %v", *val)
	}
}

func TestComputeFrequentLocationClusters(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	seedAsset(t, db, "a1", ptr(48.851), ptr(2.351), "2024-01-01T12:00:00Z")
	seedAsset(t, db, "a2", ptr(48.854), ptr(2.354), "2024-01-02T12:00:00Z")
	seedAsset(t, db, "a3", ptr(40.71), ptr(-74.0), "2024-01-03T12:00:00Z")

	clusters, err := db.computeFrequentLocationClusters(ctx, testUserID)
	if err != nil {
		t.Fatalf("computeFrequentLocationClusters: %v", err)
	}
	if len(clusters) != 2 {
		t.Fatalf("expected 2 clusters, got %d", len(clusters))
	}
	if clusters[0].AssetCount != 2 {
		t.Errorf("expected top cluster count 2, got %d", clusters[0].AssetCount)
	}
}

func TestGetAssetStackID(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	seedAsset(t, db, "a1", ptr(48.85), ptr(2.35), "2024-01-01T12:00:00Z")

	stackID, err := db.getAssetStackID(ctx, testUserID, "a1")
	if err != nil {
		t.Fatalf("getAssetStackID: %v", err)
	}
	if stackID != nil {
		t.Errorf("expected nil stack ID, got %v", *stackID)
	}

	stackID, err = db.getAssetStackID(ctx, testUserID, "nonexistent")
	if err != nil {
		t.Fatalf("getAssetStackID nonexistent: %v", err)
	}
	if stackID != nil {
		t.Errorf("expected nil for nonexistent asset, got %v", *stackID)
	}
}

func TestGetAssetStackIDWithStack(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	seedAsset(t, db, "s1", ptr(48.85), ptr(2.35), "2024-01-01T12:00:00Z")
	seedAsset(t, db, "s2", ptr(48.86), ptr(2.36), "2024-01-02T12:00:00Z")

	db.batchUpdateStackInfo(ctx, testUserID, []stackUpdateRow{
		{immichID: "s1", stackID: "stack1", primaryAssetID: nil, assetCount: 2},
		{immichID: "s2", stackID: "stack1", primaryAssetID: ptr("s1"), assetCount: 2},
	})

	stackID, err := db.getAssetStackID(ctx, testUserID, "s2")
	if err != nil {
		t.Fatalf("getAssetStackID: %v", err)
	}
	if stackID == nil || *stackID != "stack1" {
		t.Errorf("expected stack1, got %v", stackID)
	}
}

func TestGetStackMemberIDs(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	seedAsset(t, db, "s1", ptr(48.85), ptr(2.35), "2024-01-01T12:00:00Z")
	seedAsset(t, db, "s2", ptr(48.86), ptr(2.36), "2024-01-02T12:00:00Z")

	db.batchUpdateStackInfo(ctx, testUserID, []stackUpdateRow{
		{immichID: "s1", stackID: "stack1", primaryAssetID: nil, assetCount: 2},
		{immichID: "s2", stackID: "stack1", primaryAssetID: ptr("s1"), assetCount: 2},
	})

	ids, err := db.getStackMemberIDs(ctx, testUserID, "stack1")
	if err != nil {
		t.Fatalf("getStackMemberIDs: %v", err)
	}
	if len(ids) != 2 {
		t.Errorf("expected 2 members, got %d", len(ids))
	}

	ids, err = db.getStackMemberIDs(ctx, testUserID, "nonexistent")
	if err != nil {
		t.Fatalf("getStackMemberIDs nonexistent: %v", err)
	}
	if len(ids) != 0 {
		t.Errorf("expected 0 members, got %d", len(ids))
	}
}

func TestIsAssetInAlbum(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	seedAsset(t, db, "a1", ptr(48.85), ptr(2.35), "2024-01-01T12:00:00Z")
	db.upsertAlbum(ctx, testUserID, "album1", "Test", nil, 1, "2024-01-01T00:00:00Z", nil)
	db.replaceAlbumAssets(ctx, testUserID, "album1", []string{"a1"})

	inAlbum, err := db.isAssetInAlbum(ctx, testUserID, "a1", "album1")
	if err != nil {
		t.Fatalf("isAssetInAlbum: %v", err)
	}
	if !inAlbum {
		t.Error("expected asset to be in album")
	}

	inAlbum, err = db.isAssetInAlbum(ctx, testUserID, "a1", "nonexistent")
	if err != nil {
		t.Fatalf("isAssetInAlbum nonexistent album: %v", err)
	}
	if inAlbum {
		t.Error("expected asset not in nonexistent album")
	}
}

func TestGetAlbumsWithGPSCount(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	seedAsset(t, db, "a1", ptr(48.85), ptr(2.35), "2024-01-01T12:00:00Z")
	seedAsset(t, db, "a2", nil, nil, "2024-01-02T12:00:00Z")
	db.upsertAlbum(ctx, testUserID, "album1", "Test", nil, 2, "2024-01-01T00:00:00Z", nil)
	db.replaceAlbumAssets(ctx, testUserID, "album1", []string{"a1", "a2"})

	albums, err := db.getAlbumsWithGPSCount(ctx, testUserID, "", "")
	if err != nil {
		t.Fatalf("getAlbumsWithGPSCount: %v", err)
	}
	if len(albums) != 1 {
		t.Fatalf("expected 1 album, got %d", len(albums))
	}
	if albums[0].FilteredCount != 1 {
		t.Errorf("expected 1 GPS asset, got %d", albums[0].FilteredCount)
	}
	if albums[0].NoGPSCount != 1 {
		t.Errorf("expected 1 no-GPS asset, got %d", albums[0].NoGPSCount)
	}
}

func TestDeleteAlbumsNotIn(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	db.upsertAlbum(ctx, testUserID, "album1", "Keep", nil, 0, "2024-01-01T00:00:00Z", nil)
	db.upsertAlbum(ctx, testUserID, "album2", "Delete", nil, 0, "2024-01-01T00:00:00Z", nil)
	db.upsertAlbum(ctx, testUserID, "album3", "Also Delete", nil, 0, "2024-01-01T00:00:00Z", nil)

	err := db.deleteAlbumsNotIn(ctx, testUserID, []string{"album1"})
	if err != nil {
		t.Fatalf("deleteAlbumsNotIn: %v", err)
	}

	m, _ := db.getAlbumUpdatedAtMap(ctx, testUserID)
	if len(m) != 1 {
		t.Fatalf("expected 1 album remaining, got %d", len(m))
	}
	if _, ok := m["album1"]; !ok {
		t.Error("expected album1 to remain")
	}
}

func TestGetAlbumsWithNoGPSCount(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	seedAsset(t, db, "a1", ptr(48.85), ptr(2.35), "2024-01-01T12:00:00Z")
	seedAsset(t, db, "a2", nil, nil, "2024-01-02T12:00:00Z")
	db.upsertAlbum(ctx, testUserID, "album1", "Test", nil, 2, "2024-01-01T00:00:00Z", nil)
	db.replaceAlbumAssets(ctx, testUserID, "album1", []string{"a1", "a2"})

	albums, err := db.getAlbumsWithNoGPSCount(ctx, testUserID, "", "")
	if err != nil {
		t.Fatalf("getAlbumsWithNoGPSCount: %v", err)
	}
	if len(albums) != 1 {
		t.Fatalf("expected 1 album, got %d", len(albums))
	}
	if albums[0].NoGPSCount != 1 {
		t.Errorf("expected 1 no-GPS asset, got %d", albums[0].NoGPSCount)
	}
}

func TestGetAssetByIDReturnsIsHidden(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	seedAsset(t, db, "a1", ptr(48.85), ptr(2.35), "2024-01-01T12:00:00Z")

	asset, err := db.getAssetByID(ctx, testUserID, "a1")
	if err != nil {
		t.Fatalf("getAssetByID: %v", err)
	}
	if asset.IsHidden {
		t.Error("expected IsHidden == false before hiding")
	}

	if err := db.updateAssetHidden(ctx, testUserID, "a1", true); err != nil {
		t.Fatalf("updateAssetHidden: %v", err)
	}

	asset, err = db.getAssetByID(ctx, testUserID, "a1")
	if err != nil {
		t.Fatalf("getAssetByID after hide: %v", err)
	}
	if !asset.IsHidden {
		t.Error("expected IsHidden == true after hiding")
	}

	if err := db.updateAssetHidden(ctx, testUserID, "a1", false); err != nil {
		t.Fatalf("updateAssetHidden unhide: %v", err)
	}

	asset, err = db.getAssetByID(ctx, testUserID, "a1")
	if err != nil {
		t.Fatalf("getAssetByID after unhide: %v", err)
	}
	if asset.IsHidden {
		t.Error("expected IsHidden == false after unhiding")
	}
}

func TestHiddenFilterAlbumPath(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	seedAsset(t, db, "a1", ptr(48.85), ptr(2.35), "2024-01-01T12:00:00Z")
	seedAsset(t, db, "a2", ptr(40.71), ptr(-74.0), "2024-01-02T12:00:00Z")
	db.upsertAlbum(ctx, testUserID, "album1", "Test", nil, 2, "2024-01-01T00:00:00Z", nil)
	db.replaceAlbumAssets(ctx, testUserID, "album1", []string{"a1", "a2"})

	if err := db.updateAssetHidden(ctx, testUserID, "a1", true); err != nil {
		t.Fatalf("updateAssetHidden: %v", err)
	}

	visible, err := db.countFilteredAssets(ctx, testUserID, "album1", true, "visible", "", "")
	if err != nil {
		t.Fatalf("countFilteredAssets visible: %v", err)
	}
	if visible != 1 {
		t.Errorf("expected 1 visible in album, got %d", visible)
	}

	hidden, err := db.countFilteredAssets(ctx, testUserID, "album1", true, "hidden", "", "")
	if err != nil {
		t.Fatalf("countFilteredAssets hidden: %v", err)
	}
	if hidden != 1 {
		t.Errorf("expected 1 hidden in album, got %d", hidden)
	}

	all, err := db.countFilteredAssets(ctx, testUserID, "album1", true, "all", "", "")
	if err != nil {
		t.Fatalf("countFilteredAssets all: %v", err)
	}
	if all != 2 {
		t.Errorf("expected 2 total in album, got %d", all)
	}

	assets, err := db.getFilteredAssets(ctx, testUserID, "album1", true, "visible", "", "", 1, 10)
	if err != nil {
		t.Fatalf("getFilteredAssets visible: %v", err)
	}
	if len(assets) != 1 {
		t.Errorf("expected 1 visible asset in album, got %d", len(assets))
	}

	assets, err = db.getFilteredAssets(ctx, testUserID, "album1", true, "hidden", "", "", 1, 10)
	if err != nil {
		t.Fatalf("getFilteredAssets hidden: %v", err)
	}
	if len(assets) != 1 {
		t.Errorf("expected 1 hidden asset in album, got %d", len(assets))
	}
}

func TestBuildAssetFilterAlbumNoGPS(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	seedAsset(t, db, "a1", ptr(48.85), ptr(2.35), "2024-01-01T12:00:00Z")
	seedAsset(t, db, "a2", nil, nil, "2024-01-02T12:00:00Z")
	db.upsertAlbum(ctx, testUserID, "album1", "Test", nil, 2, "2024-01-01T00:00:00Z", nil)
	db.replaceAlbumAssets(ctx, testUserID, "album1", []string{"a1", "a2"})

	assets, err := db.getFilteredAssets(ctx, testUserID, "album1", false, "all", "", "", 1, 10)
	if err != nil {
		t.Fatalf("getFilteredAssets album no GPS: %v", err)
	}
	if len(assets) != 1 {
		t.Errorf("expected 1 no-GPS asset in album, got %d", len(assets))
	}

	count, err := db.countFilteredAssets(ctx, testUserID, "album1", false, "all", "", "")
	if err != nil {
		t.Fatalf("countFilteredAssets: %v", err)
	}
	if count != 1 {
		t.Errorf("expected count 1, got %d", count)
	}
}

func TestBuildAssetFilterAlbumWithGPS(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	seedAsset(t, db, "a1", ptr(48.85), ptr(2.35), "2024-01-01T12:00:00Z")
	seedAsset(t, db, "a2", nil, nil, "2024-01-02T12:00:00Z")
	db.upsertAlbum(ctx, testUserID, "album1", "Test", nil, 2, "2024-01-01T00:00:00Z", nil)
	db.replaceAlbumAssets(ctx, testUserID, "album1", []string{"a1", "a2"})

	assets, err := db.getFilteredAssets(ctx, testUserID, "album1", true, "all", "", "", 1, 10)
	if err != nil {
		t.Fatalf("getFilteredAssets album with GPS: %v", err)
	}
	if len(assets) != 1 {
		t.Errorf("expected 1 GPS asset in album, got %d", len(assets))
	}
}

func TestGetAssetPageInfoWithAlbum(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	seedAsset(t, db, "a1", ptr(48.85), ptr(2.35), "2024-01-03T12:00:00Z")
	seedAsset(t, db, "a2", ptr(40.71), ptr(-74.0), "2024-01-02T12:00:00Z")
	seedAsset(t, db, "a3", ptr(35.68), ptr(139.69), "2024-01-01T12:00:00Z")

	db.upsertAlbum(ctx, testUserID, "album1", "Test", nil, 3, "2024-01-01T00:00:00Z", nil)
	db.replaceAlbumAssets(ctx, testUserID, "album1", []string{"a1", "a2", "a3"})

	info, err := db.getAssetPageInfo(ctx, testUserID, "a2", "album1", 2)
	if err != nil {
		t.Fatalf("getAssetPageInfo with album: %v", err)
	}
	if info.AlbumID == nil || *info.AlbumID != "album1" {
		t.Errorf("expected albumID album1, got %v", info.AlbumID)
	}
	if info.Page < 1 {
		t.Errorf("expected page >= 1, got %d", info.Page)
	}
}

func TestGetAssetPageInfoAlbumFallback(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	seedAsset(t, db, "a1", ptr(48.85), ptr(2.35), "2024-01-01T12:00:00Z")
	db.upsertAlbum(ctx, testUserID, "album1", "Test", nil, 1, "2024-01-01T00:00:00Z", nil)
	db.replaceAlbumAssets(ctx, testUserID, "album1", []string{"a1"})

	info, err := db.getAssetPageInfo(ctx, testUserID, "a1", "wrong-album", 20)
	if err != nil {
		t.Fatalf("getAssetPageInfo wrong album: %v", err)
	}
	if info.AlbumID == nil || *info.AlbumID != "album1" {
		t.Errorf("expected fallback albumID album1, got %v", info.AlbumID)
	}
}

func TestGetMapMarkersWithAlbum(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	seedAsset(t, db, "a1", ptr(48.85), ptr(2.35), "2024-01-01T12:00:00Z")
	seedAsset(t, db, "a2", ptr(40.71), ptr(-74.0), "2024-01-02T12:00:00Z")
	db.upsertAlbum(ctx, testUserID, "album1", "Test", nil, 1, "2024-01-01T00:00:00Z", nil)
	db.replaceAlbumAssets(ctx, testUserID, "album1", []string{"a1"})

	markers, err := db.getMapMarkers(ctx, testUserID, "album1", nil, maxMapMarkers)
	if err != nil {
		t.Fatalf("getMapMarkers with album: %v", err)
	}
	if len(markers) != 1 {
		t.Errorf("expected 1 marker in album, got %d", len(markers))
	}
}

func TestGetMapMarkersWithAlbumAndBounds(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	seedAsset(t, db, "a1", ptr(48.85), ptr(2.35), "2024-01-01T12:00:00Z")
	seedAsset(t, db, "a2", ptr(40.71), ptr(-74.0), "2024-01-02T12:00:00Z")
	db.upsertAlbum(ctx, testUserID, "album1", "Test", nil, 2, "2024-01-01T00:00:00Z", nil)
	db.replaceAlbumAssets(ctx, testUserID, "album1", []string{"a1", "a2"})

	bounds := &TViewportBounds{North: 50, South: 45, East: 10, West: -5}
	markers, err := db.getMapMarkers(ctx, testUserID, "album1", bounds, maxMapMarkers)
	if err != nil {
		t.Fatalf("getMapMarkers album+bounds: %v", err)
	}
	if len(markers) != 1 {
		t.Errorf("expected 1 marker in album within bounds, got %d", len(markers))
	}
}

func TestDeleteAssetsNotIn(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	seedAsset(t, db, "a1", ptr(48.85), ptr(2.35), "2024-01-01T12:00:00Z")
	seedAsset(t, db, "a2", nil, nil, "2024-01-02T12:00:00Z")
	seedAsset(t, db, "a3", ptr(40.71), ptr(-74.0), "2024-01-03T12:00:00Z")

	err := db.deleteAssetsNotIn(ctx, testUserID, []string{"a1"})
	if err != nil {
		t.Fatalf("deleteAssetsNotIn: %v", err)
	}

	total, _ := db.countAssets(ctx, testUserID)
	if total != 1 {
		t.Fatalf("expected 1 asset remaining, got %d", total)
	}

	asset, _ := db.getAssetByID(ctx, testUserID, "a1")
	if asset == nil {
		t.Error("expected a1 to remain")
	}
	deleted, _ := db.getAssetByID(ctx, testUserID, "a2")
	if deleted != nil {
		t.Error("expected a2 to be deleted")
	}
}

func TestDeleteAssetsNotInEmpty(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	seedAsset(t, db, "a1", ptr(48.85), ptr(2.35), "2024-01-01T12:00:00Z")

	err := db.deleteAssetsNotIn(ctx, testUserID, []string{})
	if err != nil {
		t.Fatalf("deleteAssetsNotIn empty: %v", err)
	}

	total, _ := db.countAssets(ctx, testUserID)
	if total != 0 {
		t.Errorf("expected 0 assets, got %d", total)
	}
}

func TestDeleteAlbumsNotInEmpty(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	db.upsertAlbum(ctx, testUserID, "album1", "Delete All", nil, 0, "2024-01-01T00:00:00Z", nil)

	err := db.deleteAlbumsNotIn(ctx, testUserID, []string{})
	if err != nil {
		t.Fatalf("deleteAlbumsNotIn empty: %v", err)
	}

	m, _ := db.getAlbumUpdatedAtMap(ctx, testUserID)
	if len(m) != 0 {
		t.Errorf("expected 0 albums, got %d", len(m))
	}
}

func TestDeleteUserSyncData(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	seedAsset(t, db, "a1", ptr(48.85), ptr(2.35), "2024-01-01T12:00:00Z")
	seedAsset(t, db, "a2", ptr(40.71), ptr(-74.0), "2024-01-02T12:00:00Z")
	db.upsertAlbum(ctx, testUserID, "album1", "Test", nil, 2, "2024-01-01T00:00:00Z", nil)
	db.replaceAlbumAssets(ctx, testUserID, "album1", []string{"a1", "a2"})
	db.replaceFrequentLocations(ctx, testUserID, []FrequentLocationRow{
		{Latitude: 48.85, Longitude: 2.35, Label: "Paris", AssetCount: 10},
	})
	db.upsertLibrary(ctx, "lib1", "My Library", 5)
	db.updateLibraryVisibility(ctx, "lib1", true)
	db.setSyncState(ctx, testUserID, "lastSyncAt", "2024-01-01T00:00:00Z")

	otherUserID := "other-user-id"
	db.createUser(ctx, otherUserID, "other@example.com", "hashed")
	db.upsertAssets(ctx, otherUserID, []AssetRow{{
		ImmichID: "other-a1", Type: "IMAGE", OriginalFileName: "o.jpg", FileCreatedAt: "2024-01-01T12:00:00Z",
		Latitude: ptr(35.0), Longitude: ptr(139.0),
	}})
	db.setSyncState(ctx, otherUserID, "lastSyncAt", "2024-06-01T00:00:00Z")

	if err := db.deleteUserSyncData(ctx, testUserID); err != nil {
		t.Fatalf("deleteUserSyncData: %v", err)
	}

	assets, _ := db.countAssets(ctx, testUserID)
	if assets != 0 {
		t.Errorf("expected 0 assets for target user, got %d", assets)
	}
	albums, _ := db.getAlbumUpdatedAtMap(ctx, testUserID)
	if len(albums) != 0 {
		t.Errorf("expected 0 albums for target user, got %d", len(albums))
	}
	locs, _ := db.getFrequentLocations(ctx, testUserID, 10)
	if len(locs) != 0 {
		t.Errorf("expected 0 frequent locations for target user, got %d", len(locs))
	}
	libs, _ := db.getLibraries(ctx)
	if len(libs) != 1 {
		t.Errorf("expected 1 global library preserved, got %d", len(libs))
	}
	syncVal, _ := db.getSyncState(ctx, testUserID, "lastSyncAt")
	if syncVal != nil {
		t.Errorf("expected nil syncState for target user, got %v", *syncVal)
	}

	otherAssets, _ := db.countAssets(ctx, otherUserID)
	if otherAssets != 1 {
		t.Errorf("expected 1 asset for other user, got %d", otherAssets)
	}
	otherSync, _ := db.getSyncState(ctx, otherUserID, "lastSyncAt")
	if otherSync == nil || *otherSync != "2024-06-01T00:00:00Z" {
		t.Errorf("expected other user syncState preserved, got %v", otherSync)
	}
}
