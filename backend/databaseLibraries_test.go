package main

import (
	"context"
	"testing"
)

func TestUpsertAndGetLibraries(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	err := db.upsertLibrary(ctx, "lib1", "Photos", 100)
	if err != nil {
		t.Fatalf("upsertLibrary: %v", err)
	}
	err = db.upsertLibrary(ctx, "lib2", "Videos", 50)
	if err != nil {
		t.Fatalf("upsertLibrary: %v", err)
	}

	seedAssetWithLibrary(t, db, "a1", ptr(48.85), ptr(2.35), "2024-01-01T12:00:00Z", ptr("lib1"))
	seedAssetWithLibrary(t, db, "a2", ptr(40.71), ptr(-74.0), "2024-01-02T12:00:00Z", ptr("lib1"))

	libs, err := db.getLibraries(ctx)
	if err != nil {
		t.Fatalf("getLibraries: %v", err)
	}
	if len(libs) != 2 {
		t.Fatalf("expected 2 libraries, got %d", len(libs))
	}
	if libs[0].Name != "Photos" {
		t.Errorf("expected first lib 'Photos' (sorted), got %s", libs[0].Name)
	}
	if libs[0].AssetCount != 2 {
		t.Errorf("expected 2 assets (from local count), got %d", libs[0].AssetCount)
	}
	if libs[1].AssetCount != 0 {
		t.Errorf("expected 0 assets for Videos, got %d", libs[1].AssetCount)
	}
	if libs[0].IsHidden {
		t.Error("expected new library to not be hidden")
	}
}

func TestUpsertLibraryUpdatesExisting(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	db.upsertLibrary(ctx, "lib1", "Old Name", 10)
	db.upsertLibrary(ctx, "lib1", "New Name", 200)

	libs, _ := db.getLibraries(ctx)
	if len(libs) != 1 {
		t.Fatalf("expected 1 library after upsert, got %d", len(libs))
	}
	if libs[0].Name != "New Name" {
		t.Errorf("expected name 'New Name', got %s", libs[0].Name)
	}
}

func TestUpdateLibraryVisibility(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	db.upsertLibrary(ctx, "lib1", "Photos", 100)

	err := db.updateLibraryVisibility(ctx, "lib1", true)
	if err != nil {
		t.Fatalf("updateLibraryVisibility: %v", err)
	}

	libs, _ := db.getLibraries(ctx)
	if !libs[0].IsHidden {
		t.Error("expected library to be hidden")
	}

	err = db.updateLibraryVisibility(ctx, "lib1", false)
	if err != nil {
		t.Fatalf("updateLibraryVisibility unhide: %v", err)
	}

	libs, _ = db.getLibraries(ctx)
	if libs[0].IsHidden {
		t.Error("expected library to not be hidden")
	}
}

func TestUpdateLibraryVisibilityNotFound(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	err := db.updateLibraryVisibility(ctx, "nonexistent", true)
	if err == nil {
		t.Error("expected error for nonexistent library")
	}
}

func TestDeleteLibrariesNotIn(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	db.upsertLibrary(ctx, "lib1", "Keep", 10)
	db.upsertLibrary(ctx, "lib2", "Remove", 20)
	db.upsertLibrary(ctx, "lib3", "Also Remove", 30)

	err := db.deleteLibrariesNotIn(ctx, []string{"lib1"})
	if err != nil {
		t.Fatalf("deleteLibrariesNotIn: %v", err)
	}

	libs, _ := db.getLibraries(ctx)
	if len(libs) != 1 {
		t.Fatalf("expected 1 library, got %d", len(libs))
	}
	if libs[0].LibraryID != "lib1" {
		t.Errorf("expected lib1, got %s", libs[0].LibraryID)
	}
}

func TestDeleteLibrariesNotInKeepsLibrariesLinkedToAssets(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	otherUserID := "other-user-id"
	if err := db.createUser(ctx, otherUserID, "other@example.com", "hashed"); err != nil {
		t.Fatalf("create other user: %v", err)
	}
	if err := db.upsertAssets(ctx, otherUserID, []AssetRow{{
		ImmichID:         "other-a1",
		Type:             "IMAGE",
		OriginalFileName: "other-a1.jpg",
		FileCreatedAt:    "2024-01-01T12:00:00Z",
		LibraryID:        ptr("lib2"),
	}}); err != nil {
		t.Fatalf("seed other user asset: %v", err)
	}

	db.upsertLibrary(ctx, "lib1", "Keep", 10)
	db.upsertLibrary(ctx, "lib2", "Shared", 20)

	err := db.deleteLibrariesNotIn(ctx, []string{"lib1"})
	if err != nil {
		t.Fatalf("deleteLibrariesNotIn: %v", err)
	}

	libs, _ := db.getLibraries(ctx)
	if len(libs) != 2 {
		t.Fatalf("expected 2 libraries (lib1 kept + lib2 linked to assets), got %d", len(libs))
	}
}

func TestLibraryVisibilityIsGlobal(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	otherUserID := "other-user-id"
	if err := db.createUser(ctx, otherUserID, "other@example.com", "hashed"); err != nil {
		t.Fatalf("create other user: %v", err)
	}

	if err := db.upsertAssets(ctx, testUserID, []AssetRow{{
		ImmichID:         "a1",
		Type:             "IMAGE",
		OriginalFileName: "a1.jpg",
		FileCreatedAt:    "2024-01-01T12:00:00Z",
		LibraryID:        ptr("lib1"),
	}}); err != nil {
		t.Fatalf("seed test user asset: %v", err)
	}
	if err := db.upsertAssets(ctx, otherUserID, []AssetRow{{
		ImmichID:         "b1",
		Type:             "IMAGE",
		OriginalFileName: "b1.jpg",
		FileCreatedAt:    "2024-01-01T12:00:00Z",
		LibraryID:        ptr("lib1"),
	}}); err != nil {
		t.Fatalf("seed other user asset: %v", err)
	}

	if err := db.upsertLibrary(ctx, "lib1", "Shared", 1); err != nil {
		t.Fatalf("upsert library: %v", err)
	}
	if err := db.updateLibraryVisibility(ctx, "lib1", true); err != nil {
		t.Fatalf("hide library: %v", err)
	}

	testUserCount, _ := db.countAssets(ctx, testUserID)
	if testUserCount != 0 {
		t.Fatalf("expected hidden assets for test user, got %d", testUserCount)
	}

	otherUserCount, _ := db.countAssets(ctx, otherUserID)
	if otherUserCount != 0 {
		t.Fatalf("expected hidden assets for other user too (global), got %d", otherUserCount)
	}
}

func TestDeleteLibrariesNotInEmpty(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	db.upsertLibrary(ctx, "lib1", "Delete All", 10)

	err := db.deleteLibrariesNotIn(ctx, []string{})
	if err != nil {
		t.Fatalf("deleteLibrariesNotIn empty: %v", err)
	}

	libs, _ := db.getLibraries(ctx)
	if len(libs) != 0 {
		t.Errorf("expected 0 libraries, got %d", len(libs))
	}
}

func TestGetHiddenLibraryIDs(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	db.upsertLibrary(ctx, "lib1", "Visible", 10)
	db.upsertLibrary(ctx, "lib2", "Hidden", 20)
	db.updateLibraryVisibility(ctx, "lib2", true)

	ids, err := db.getHiddenLibraryIDs(ctx)
	if err != nil {
		t.Fatalf("getHiddenLibraryIDs: %v", err)
	}
	if len(ids) != 1 {
		t.Fatalf("expected 1 hidden library, got %d", len(ids))
	}
	if ids[0] != "lib2" {
		t.Errorf("expected lib2, got %s", ids[0])
	}
}

func seedAssetWithLibrary(t *testing.T, db *Database, id string, lat, lon *float64, fileCreatedAt string, libraryID *string) {
	t.Helper()
	err := db.upsertAssets(context.Background(), testUserID, []AssetRow{{
		ImmichID:         id,
		Type:             "IMAGE",
		OriginalFileName: id + ".jpg",
		FileCreatedAt:    fileCreatedAt,
		Latitude:         lat,
		Longitude:        lon,
		LibraryID:        libraryID,
	}})
	if err != nil {
		t.Fatalf("failed to seed asset %s: %v", id, err)
	}
}

func TestHiddenLibraryAssetsExcludedFromCount(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	db.upsertLibrary(ctx, "lib1", "External", 2)

	seedAssetWithLibrary(t, db, "a1", ptr(48.85), ptr(2.35), "2024-01-01T12:00:00Z", nil)
	seedAssetWithLibrary(t, db, "a2", ptr(40.71), ptr(-74.0), "2024-01-02T12:00:00Z", ptr("lib1"))
	seedAssetWithLibrary(t, db, "a3", nil, nil, "2024-01-03T12:00:00Z", ptr("lib1"))

	total, _ := db.countAssets(ctx, testUserID)
	if total != 3 {
		t.Errorf("before hiding: expected 3 total, got %d", total)
	}

	db.updateLibraryVisibility(ctx, "lib1", true)

	total, _ = db.countAssets(ctx, testUserID)
	if total != 1 {
		t.Errorf("after hiding lib1: expected 1 total, got %d", total)
	}

	noGPS, _ := db.countNoGPSAssets(ctx, testUserID)
	if noGPS != 0 {
		t.Errorf("after hiding: expected 0 no-GPS, got %d", noGPS)
	}
}

func TestHiddenLibraryAssetsExcludedFromMapMarkers(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	seedAssetWithLibrary(t, db, "a1", ptr(48.85), ptr(2.35), "2024-01-01T12:00:00Z", nil)
	seedAssetWithLibrary(t, db, "a2", ptr(40.71), ptr(-74.0), "2024-01-02T12:00:00Z", ptr("lib1"))

	db.upsertLibrary(ctx, "lib1", "External", 1)
	db.updateLibraryVisibility(ctx, "lib1", true)

	markers, err := db.getMapMarkers(ctx, testUserID, "", nil, maxMapMarkers)
	if err != nil {
		t.Fatalf("getMapMarkers: %v", err)
	}
	if len(markers) != 1 {
		t.Errorf("expected 1 marker after hiding library, got %d", len(markers))
	}
}

func TestHiddenLibraryAssetsExcludedFromFilteredAssets(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	seedAssetWithLibrary(t, db, "a1", ptr(48.85), ptr(2.35), "2024-01-01T12:00:00Z", nil)
	seedAssetWithLibrary(t, db, "a2", ptr(40.71), ptr(-74.0), "2024-01-02T12:00:00Z", ptr("lib1"))

	db.upsertLibrary(ctx, "lib1", "External", 1)
	db.updateLibraryVisibility(ctx, "lib1", true)

	assets, err := db.getFilteredAssets(ctx, testUserID, "", true, "all", 1, 10)
	if err != nil {
		t.Fatalf("getFilteredAssets: %v", err)
	}
	if len(assets) != 1 {
		t.Errorf("expected 1 filtered asset, got %d", len(assets))
	}

	count, err := db.countFilteredAssets(ctx, testUserID, "", true, "all")
	if err != nil {
		t.Fatalf("countFilteredAssets: %v", err)
	}
	if count != 1 {
		t.Errorf("expected count 1, got %d", count)
	}
}

func TestUnhidingLibraryRestoresAssets(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	seedAssetWithLibrary(t, db, "a1", ptr(48.85), ptr(2.35), "2024-01-01T12:00:00Z", ptr("lib1"))
	db.upsertLibrary(ctx, "lib1", "External", 1)
	db.updateLibraryVisibility(ctx, "lib1", true)

	total, _ := db.countAssets(ctx, testUserID)
	if total != 0 {
		t.Errorf("expected 0 after hiding, got %d", total)
	}

	db.updateLibraryVisibility(ctx, "lib1", false)
	total, _ = db.countAssets(ctx, testUserID)
	if total != 1 {
		t.Errorf("expected 1 after unhiding, got %d", total)
	}
}

func TestUnknownLibraryAssetsVisible(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	seedAssetWithLibrary(t, db, "a1", ptr(48.85), ptr(2.35), "2024-01-01T12:00:00Z", nil)
	seedAssetWithLibrary(t, db, "a2", ptr(40.71), ptr(-74.0), "2024-01-02T12:00:00Z", ptr("lib1"))
	seedAssetWithLibrary(t, db, "a3", ptr(35.68), ptr(139.69), "2024-01-03T12:00:00Z", ptr("lib1"))

	total, _ := db.countAssets(ctx, testUserID)
	if total != 3 {
		t.Errorf("expected 3 assets, got %d", total)
	}

	markers, _ := db.getMapMarkers(ctx, testUserID, "", nil, maxMapMarkers)
	if len(markers) != 3 {
		t.Errorf("expected 3 markers, got %d", len(markers))
	}

	db.upsertLibrary(ctx, "lib1", "External", 2)
	total, _ = db.countAssets(ctx, testUserID)
	if total != 3 {
		t.Errorf("after registering library: expected 3 assets, got %d", total)
	}
}

func TestNeedsLibraryIDBackfillNoLibraries(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	needs, err := db.needsLibraryIDBackfill(ctx, testUserID)
	if err != nil {
		t.Fatalf("needsLibraryIDBackfill: %v", err)
	}
	if needs {
		t.Error("expected false when no libraries exist")
	}
}

func TestNeedsLibraryIDBackfillNoAssets(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	db.setSyncState(ctx, testUserID, "hasLibraryAccess", "true")
	db.upsertLibrary(ctx, "lib1", "External", 10)

	needs, err := db.needsLibraryIDBackfill(ctx, testUserID)
	if err != nil {
		t.Fatalf("needsLibraryIDBackfill: %v", err)
	}
	if needs {
		t.Error("expected false when user has no assets (nothing to backfill)")
	}
}

func TestNeedsLibraryIDBackfillWithTaggedAssets(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	db.setSyncState(ctx, testUserID, "hasLibraryAccess", "true")
	db.upsertLibrary(ctx, "lib1", "External", 10)
	seedAssetWithLibrary(t, db, "a1", ptr(48.85), ptr(2.35), "2024-01-01T12:00:00Z", ptr("lib1"))

	needs, err := db.needsLibraryIDBackfill(ctx, testUserID)
	if err != nil {
		t.Fatalf("needsLibraryIDBackfill: %v", err)
	}
	if needs {
		t.Error("expected false when assets already have libraryID")
	}
}

func TestNeedsLibraryIDBackfillWithMixedTaggedAndUntaggedAssets(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	db.setSyncState(ctx, testUserID, "hasLibraryAccess", "true")
	db.upsertLibrary(ctx, "lib1", "External", 10)
	seedAssetWithLibrary(t, db, "a1", ptr(48.85), ptr(2.35), "2024-01-01T12:00:00Z", ptr("lib1"))
	seedAssetWithLibrary(t, db, "a2", ptr(40.71), ptr(-74.0), "2024-01-02T12:00:00Z", nil)

	needs, err := db.needsLibraryIDBackfill(ctx, testUserID)
	if err != nil {
		t.Fatalf("needsLibraryIDBackfill: %v", err)
	}
	if !needs {
		t.Error("expected true when at least one asset is missing libraryID")
	}
}

func TestNeedsLibraryIDBackfillWithUntaggedAssets(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	db.setSyncState(ctx, testUserID, "hasLibraryAccess", "true")
	db.upsertLibrary(ctx, "lib1", "External", 10)
	seedAssetWithLibrary(t, db, "a1", ptr(48.85), ptr(2.35), "2024-01-01T12:00:00Z", nil)

	needs, err := db.needsLibraryIDBackfill(ctx, testUserID)
	if err != nil {
		t.Fatalf("needsLibraryIDBackfill: %v", err)
	}
	if !needs {
		t.Error("expected true when libraries exist but no assets have libraryID")
	}
}

func TestNeedsLibraryIDBackfillSkippedWhenMarkedDone(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	db.setSyncState(ctx, testUserID, "hasLibraryAccess", "true")
	db.upsertLibrary(ctx, "lib1", "External", 10)
	seedAssetWithLibrary(t, db, "a1", ptr(48.85), ptr(2.35), "2024-01-01T12:00:00Z", nil)
	if err := db.setSyncState(ctx, testUserID, "libraryIDBackfillDone", "true"); err != nil {
		t.Fatalf("setSyncState libraryIDBackfillDone: %v", err)
	}

	needs, err := db.needsLibraryIDBackfill(ctx, testUserID)
	if err != nil {
		t.Fatalf("needsLibraryIDBackfill: %v", err)
	}
	if needs {
		t.Error("expected false when libraryID backfill is already marked done")
	}
}

func TestGetLibrariesCountsAcrossAllUsers(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	otherUserID := "other-user-id"
	if err := db.createUser(ctx, otherUserID, "other@example.com", "hashed"); err != nil {
		t.Fatalf("create other user: %v", err)
	}

	db.upsertLibrary(ctx, "lib1", "Shared Library", 100)

	seedAssetWithLibrary(t, db, "a1", ptr(48.85), ptr(2.35), "2024-01-01T12:00:00Z", ptr("lib1"))
	if err := db.upsertAssets(ctx, otherUserID, []AssetRow{{
		ImmichID:         "b1",
		Type:             "IMAGE",
		OriginalFileName: "b1.jpg",
		FileCreatedAt:    "2024-01-02T12:00:00Z",
		LibraryID:        ptr("lib1"),
	}}); err != nil {
		t.Fatalf("seed other user asset: %v", err)
	}

	libs, err := db.getLibraries(ctx)
	if err != nil {
		t.Fatalf("getLibraries: %v", err)
	}
	if len(libs) != 1 {
		t.Fatalf("expected 1 library, got %d", len(libs))
	}
	if libs[0].AssetCount != 2 {
		t.Errorf("expected 2 assets counted across both users, got %d", libs[0].AssetCount)
	}
}
