package main

import (
	"context"
	"testing"
)

func datedAsset(id, p, dateTimeOriginal string) AssetRow {
	asset := extAsset(id, p)
	asset.DateTimeOriginal = ptr(dateTimeOriginal)
	return asset
}

// The date range covers the whole endDate day: buildAssetFilter compares against
// endDate+"T99", which sorts after any time-of-day on that date. An asset stamped
// 23:59 on the last day of the range therefore still belongs to it.
func TestGetFolderDateRangeFilter(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	db.upsertAssets(ctx, testUserID, []AssetRow{
		datedAsset("before", "/lib/trip/before.jpg", "2023-12-31T23:59:59Z"),
		datedAsset("first", "/lib/trip/first.jpg", "2024-01-01T00:00:00Z"),
		datedAsset("last", "/lib/trip/last.jpg", "2024-01-31T23:59:59Z"),
		datedAsset("after", "/lib/trip/after.jpg", "2024-02-01T00:00:00Z"),
	})

	tree, err := db.getFolderTree(ctx, testUserID, gpsFilterNoGPS, hiddenFilterVisible, "", "2024-01-01", "2024-01-31")
	if err != nil {
		t.Fatalf("getFolderTree: %v", err)
	}
	if node := findNode(tree.Children, "/lib/trip"); node == nil || node.AssetCount != 2 {
		t.Errorf("expected /lib/trip count 2 inside the range, got %+v", node)
	}

	assets, total, err := db.getFolderAssets(ctx, testUserID, "/lib/trip", gpsFilterNoGPS, hiddenFilterVisible, "", "2024-01-01", "2024-01-31", 1, 50)
	if err != nil {
		t.Fatalf("getFolderAssets: %v", err)
	}
	if total != 2 || len(assets) != 2 {
		t.Fatalf("expected 2 assets inside the range, got total=%d len=%d", total, len(assets))
	}
	for _, asset := range assets {
		if asset.ImmichID == "before" || asset.ImmichID == "after" {
			t.Errorf("asset %q sits outside the range and must not be returned", asset.ImmichID)
		}
	}

	// An unbounded range must not silently drop the assets that carry no date at all.
	undated, total, err := db.getFolderAssets(ctx, testUserID, "/lib/trip", gpsFilterNoGPS, hiddenFilterVisible, "", "", "", 1, 50)
	if err != nil {
		t.Fatalf("getFolderAssets unbounded: %v", err)
	}
	if total != 4 || len(undated) != 4 {
		t.Errorf("expected all 4 assets without a range, got total=%d len=%d", total, len(undated))
	}
}

// Two folders differing only by case are two distinct nodes in the tree, so opening
// one must not return the other's assets. SQLite's LIKE is ASCII case-insensitive,
// which is why the prefix match uses a range comparison instead.
func TestGetFolderAssetsCaseSensitive(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	db.upsertAssets(ctx, testUserID, []AssetRow{
		extAsset("upper", "/lib/Trip/upper.jpg"),
		extAsset("lower", "/lib/trip/lower.jpg"),
	})

	tree, err := db.getFolderTree(ctx, testUserID, gpsFilterNoGPS, hiddenFilterVisible, "", "", "")
	if err != nil {
		t.Fatalf("getFolderTree: %v", err)
	}
	upperNode := findNode(tree.Children, "/lib/Trip")
	lowerNode := findNode(tree.Children, "/lib/trip")
	if upperNode == nil || lowerNode == nil {
		t.Fatalf("expected both /lib/Trip and /lib/trip nodes, got %+v", tree.Children)
	}
	if upperNode.AssetCount != 1 || lowerNode.AssetCount != 1 {
		t.Errorf("expected 1 asset per node, got Trip=%d trip=%d", upperNode.AssetCount, lowerNode.AssetCount)
	}

	// The grid must agree with the count shown on the node it was opened from.
	assets, total, err := db.getFolderAssets(ctx, testUserID, "/lib/Trip", gpsFilterNoGPS, hiddenFilterVisible, "", "", "", 1, 50)
	if err != nil {
		t.Fatalf("getFolderAssets: %v", err)
	}
	if total != 1 || len(assets) != 1 {
		t.Fatalf("expected exactly 1 asset in /lib/Trip, got total=%d len=%d", total, len(assets))
	}
	if assets[0].ImmichID != "upper" {
		t.Errorf("expected 'upper', got %q (the prefix match is case-insensitive)", assets[0].ImmichID)
	}
}

func TestGetFolderHiddenFilter(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	db.upsertAssets(ctx, testUserID, []AssetRow{
		extAsset("visible", "/lib/trip/visible.jpg"),
		extAsset("hidden", "/lib/trip/hidden.jpg"),
	})
	// isHidden is a local flag: upsertAssets never binds it, so that a resync cannot
	// undo the user's own hide choices. It has to be set through the update path.
	if err := db.bulkUpdateAssetHidden(ctx, testUserID, []string{"hidden"}, true); err != nil {
		t.Fatalf("bulkUpdateAssetHidden: %v", err)
	}

	testCases := []struct {
		filter        string
		expectedCount int
	}{
		{hiddenFilterVisible, 1},
		{hiddenFilterHidden, 1},
		{hiddenFilterAll, 2},
	}

	for _, testCase := range testCases {
		tree, err := db.getFolderTree(ctx, testUserID, gpsFilterNoGPS, testCase.filter, "", "", "")
		if err != nil {
			t.Fatalf("getFolderTree %s: %v", testCase.filter, err)
		}
		node := findNode(tree.Children, "/lib/trip")
		if node == nil || node.AssetCount != testCase.expectedCount {
			t.Errorf("tree %s: expected count %d, got %+v", testCase.filter, testCase.expectedCount, node)
		}

		_, total, err := db.getFolderAssets(ctx, testUserID, "/lib/trip", gpsFilterNoGPS, testCase.filter, "", "", "", 1, 50)
		if err != nil {
			t.Fatalf("getFolderAssets %s: %v", testCase.filter, err)
		}
		if total != testCase.expectedCount {
			t.Errorf("assets %s: expected total %d, got %d", testCase.filter, testCase.expectedCount, total)
		}
	}
}

// The "all" GPS filter is the only state in which a folder reports its full contents.
func TestGetFolderGPSFilterAll(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	lat, lon := 48.85, 2.35
	located := extAsset("located", "/lib/trip/located.jpg")
	located.Latitude, located.Longitude = &lat, &lon
	db.upsertAssets(ctx, testUserID, []AssetRow{
		located,
		extAsset("unlocated", "/lib/trip/unlocated.jpg"),
	})

	testCases := []struct {
		filter        string
		expectedCount int
	}{
		{gpsFilterWithGPS, 1},
		{gpsFilterNoGPS, 1},
		{gpsFilterAll, 2},
	}

	for _, testCase := range testCases {
		tree, err := db.getFolderTree(ctx, testUserID, testCase.filter, hiddenFilterVisible, "", "", "")
		if err != nil {
			t.Fatalf("getFolderTree %s: %v", testCase.filter, err)
		}
		node := findNode(tree.Children, "/lib/trip")
		if node == nil || node.AssetCount != testCase.expectedCount {
			t.Errorf("tree %s: expected count %d, got %+v", testCase.filter, testCase.expectedCount, node)
		}

		_, total, err := db.getFolderAssets(ctx, testUserID, "/lib/trip", testCase.filter, hiddenFilterVisible, "", "", "", 1, 50)
		if err != nil {
			t.Fatalf("getFolderAssets %s: %v", testCase.filter, err)
		}
		if total != testCase.expectedCount {
			t.Errorf("assets %s: expected total %d, got %d", testCase.filter, testCase.expectedCount, total)
		}
	}

	// The tag filter takes the aliased JOIN branch, which builds its WHERE clause
	// separately and must handle "all" the same way.
	if err := db.upsertTag(ctx, testUserID, "tag1", "Trip", "Trip", nil, nil); err != nil {
		t.Fatalf("upsertTag: %v", err)
	}
	if err := db.replaceTagAssets(ctx, testUserID, "tag1", []string{"located", "unlocated"}); err != nil {
		t.Fatalf("replaceTagAssets: %v", err)
	}
	_, total, err := db.getFolderAssets(ctx, testUserID, "/lib/trip", gpsFilterAll, hiddenFilterVisible, "tag1", "", "", 1, 50)
	if err != nil {
		t.Fatalf("getFolderAssets aliased: %v", err)
	}
	if total != 2 {
		t.Errorf("expected 2 assets under the aliased branch with gpsFilter=all, got %d", total)
	}
}

// The albums endpoint reports each album's asset count under the active GPS filter.
// Under "all" that must be the album's full contents, not its missing-location count.
func TestGetAlbumsByGPSFilter(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	lat, lon := 48.85, 2.35
	located := extAsset("located", "/lib/trip/located.jpg")
	located.Latitude, located.Longitude = &lat, &lon
	db.upsertAssets(ctx, testUserID, []AssetRow{
		located,
		extAsset("unlocated1", "/lib/trip/unlocated1.jpg"),
		extAsset("unlocated2", "/lib/trip/unlocated2.jpg"),
	})
	if err := db.upsertAlbum(ctx, testUserID, "album1", "Trip", nil, 3, "2024-01-01T00:00:00Z", nil); err != nil {
		t.Fatalf("upsertAlbum: %v", err)
	}
	if err := db.replaceAlbumAssets(ctx, testUserID, "album1", []string{"located", "unlocated1", "unlocated2"}); err != nil {
		t.Fatalf("replaceAlbumAssets: %v", err)
	}

	testCases := []struct {
		filter        string
		expectedCount int
	}{
		{gpsFilterNoGPS, 2},
		{gpsFilterAll, 3},
	}

	for _, testCase := range testCases {
		albums, err := db.getAlbumsByGPSFilter(ctx, testUserID, testCase.filter, "", "")
		if err != nil {
			t.Fatalf("getAlbumsByGPSFilter %s: %v", testCase.filter, err)
		}
		if len(albums) != 1 {
			t.Fatalf("%s: expected 1 album, got %d", testCase.filter, len(albums))
		}
		if albums[0].FilteredCount != testCase.expectedCount {
			t.Errorf("%s: expected filteredCount %d, got %d", testCase.filter, testCase.expectedCount, albums[0].FilteredCount)
		}
		// noGPSCount stays the missing-location count whatever the active filter.
		if albums[0].NoGPSCount != 2 {
			t.Errorf("%s: expected noGPSCount 2, got %d", testCase.filter, albums[0].NoGPSCount)
		}
	}
}

// A degenerate folder path must resolve to nothing rather than to the whole library:
// "" would build the range [ "/", "0" ), which matches every absolute path.
func TestGetFolderAssetsDegeneratePath(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	db.upsertAssets(ctx, testUserID, []AssetRow{
		extAsset("a", "/lib/trip/a.jpg"),
		extAsset("b", "/mnt/other/b.jpg"),
	})

	for _, folderPath := range []string{"", "/"} {
		assets, total, err := db.getFolderAssets(ctx, testUserID, folderPath, gpsFilterNoGPS, hiddenFilterVisible, "", "", "", 1, 50)
		if err != nil {
			t.Fatalf("getFolderAssets %q: %v", folderPath, err)
		}
		if total != 0 || len(assets) != 0 {
			t.Errorf("%q must match nothing, got total=%d len=%d", folderPath, total, len(assets))
		}
	}

	// A trailing slash still resolves to the folder it names.
	_, total, err := db.getFolderAssets(ctx, testUserID, "/lib/trip/", gpsFilterNoGPS, hiddenFilterVisible, "", "", "", 1, 50)
	if err != nil {
		t.Fatalf("getFolderAssets trailing slash: %v", err)
	}
	if total != 1 {
		t.Errorf("expected 1 asset for a trailing-slash path, got %d", total)
	}
}
