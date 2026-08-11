package main

import (
	"context"
	"testing"
)

func extAsset(id, path string) AssetRow {
	return AssetRow{
		ImmichID: id, Type: "IMAGE", OriginalFileName: id + ".jpg",
		OriginalPath: path, FileCreatedAt: "2024-01-01T00:00:00Z",
		LibraryID: ptr("lib1"),
	}
}

func findNode(nodes []FolderNode, path string) *FolderNode {
	for i := range nodes {
		if nodes[i].Path == path {
			return &nodes[i]
		}
		if found := findNode(nodes[i].Children, path); found != nil {
			return found
		}
	}
	return nil
}

func TestNormalizeOriginalPath(t *testing.T) {
	upload := "/usr/src/app/upload/library/df6fba2a-63e4-49bf-a6ec-fb266b45e813/2026/2026-07-24/L1.jpg"
	if got := normalizeOriginalPath(upload, nil); got != "2026/2026-07-24/L1.jpg" {
		t.Errorf("upload strip: expected year-rooted path, got %q", got)
	}

	external := "/mnt/media/externalLibTest/26/x.jpg"
	if got := normalizeOriginalPath(external, ptr("lib1")); got != external {
		t.Errorf("external path must be unchanged, got %q", got)
	}

	// An upload path without the /library/<uuid>/ structure is left as-is (graceful fallback).
	odd := "/some/other/path/x.jpg"
	if got := normalizeOriginalPath(odd, nil); got != odd {
		t.Errorf("non-matching upload path must be unchanged, got %q", got)
	}
}

func TestGetFolderTreeIncludesUploadsAndExternal(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	db.upsertAssets(ctx, testUserID, []AssetRow{
		extAsset("a", "/mnt/photos/2023/Vacation/a.jpg"),
		extAsset("b", "/mnt/photos/2023/Vacation/b.jpg"),
		extAsset("c", "/mnt/photos/2023/Birthday/c.jpg"),
		// Uploaded asset, stored normalized (year-rooted) as the sync would store it.
		{
			ImmichID: "up", Type: "IMAGE", OriginalFileName: "up.jpg",
			OriginalPath:  "2026/2026-01-01/up.jpg",
			FileCreatedAt: "2024-01-01T00:00:00Z",
		},
	})

	tree, err := db.getFolderTree(ctx, testUserID, gpsFilterNoGPS, hiddenFilterVisible, "", "", "")
	if err != nil {
		t.Fatalf("getFolderTree: %v", err)
	}

	// The internal upload prefix is gone; the upload surfaces as a year folder.
	if findNode(tree.Children, "/usr") != nil {
		t.Error("normalized uploads must not carry the /usr internal prefix")
	}
	year := findNode(tree.Children, "2026")
	if year == nil || year.AssetCount != 1 {
		t.Errorf("expected year folder 2026 with count 1, got %+v", year)
	}

	root := findNode(tree.Children, "/mnt/photos")
	if root == nil {
		t.Fatal("expected /mnt/photos node")
	}
	if root.AssetCount != 3 {
		t.Errorf("expected /mnt/photos count 3 (sum of descendants), got %d", root.AssetCount)
	}

	vacation := findNode(tree.Children, "/mnt/photos/2023/Vacation")
	if vacation == nil || vacation.AssetCount != 2 {
		t.Errorf("expected /mnt/photos/2023/Vacation count 2, got %+v", vacation)
	}
	birthday := findNode(tree.Children, "/mnt/photos/2023/Birthday")
	if birthday == nil || birthday.AssetCount != 1 {
		t.Errorf("expected /mnt/photos/2023/Birthday count 1, got %+v", birthday)
	}
}

// Folder counts are scoped to the active GPS filter, so the same folder reports a
// different number under "Missing location" and "With location".
func TestGetFolderTreeGPSFilter(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	lat, lon := 48.85, 2.35
	located := extAsset("g1", "/mnt/photos/Trip/g1.jpg")
	located.Latitude, located.Longitude = &lat, &lon
	db.upsertAssets(ctx, testUserID, []AssetRow{
		located,
		extAsset("n1", "/mnt/photos/Trip/n1.jpg"),
		extAsset("n2", "/mnt/photos/Trip/n2.jpg"),
	})

	withGPS, err := db.getFolderTree(ctx, testUserID, gpsFilterWithGPS, hiddenFilterVisible, "", "", "")
	if err != nil {
		t.Fatalf("getFolderTree with-gps: %v", err)
	}
	if node := findNode(withGPS.Children, "/mnt/photos/Trip"); node == nil || node.AssetCount != 1 {
		t.Errorf("expected with-gps count 1, got %+v", node)
	}

	noGPS, err := db.getFolderTree(ctx, testUserID, gpsFilterNoGPS, hiddenFilterVisible, "", "", "")
	if err != nil {
		t.Fatalf("getFolderTree no-gps: %v", err)
	}
	if node := findNode(noGPS.Children, "/mnt/photos/Trip"); node == nil || node.AssetCount != 2 {
		t.Errorf("expected no-gps count 2, got %+v", node)
	}
}

// A folder named "my_photos" must not leak its sibling "myXphotos". '_' is a LIKE
// wildcard, so this pins that the prefix match never treats it as one.
func TestGetFolderAssetsSiblingNotMatched(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	db.upsertAssets(ctx, testUserID, []AssetRow{
		extAsset("inside", "/lib/my_photos/inside.jpg"),
		extAsset("sibling", "/lib/myXphotos/sibling.jpg"),
	})

	assets, total, err := db.getFolderAssets(ctx, testUserID, "/lib/my_photos", gpsFilterNoGPS, hiddenFilterVisible, "", "", "", 1, 50)
	if err != nil {
		t.Fatalf("getFolderAssets: %v", err)
	}
	if total != 1 || len(assets) != 1 {
		t.Fatalf("expected exactly 1 asset in /lib/my_photos, got total=%d len=%d", total, len(assets))
	}
	if assets[0].ImmichID != "inside" {
		t.Errorf("expected 'inside', got %q ('_' was treated as a wildcard)", assets[0].ImmichID)
	}
}

func TestGetFolderAssetsRecursiveAndPagination(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	db.upsertAssets(ctx, testUserID, []AssetRow{
		extAsset("root1", "/lib/trip/root1.jpg"),
		extAsset("deep1", "/lib/trip/day1/deep1.jpg"),
		extAsset("deep2", "/lib/trip/day2/deep2.jpg"),
		extAsset("other", "/lib/elsewhere/other.jpg"),
	})

	// Recursive: /lib/trip returns the direct file plus both subfolder files, not /lib/elsewhere.
	_, total, err := db.getFolderAssets(ctx, testUserID, "/lib/trip", gpsFilterNoGPS, hiddenFilterVisible, "", "", "", 1, 50)
	if err != nil {
		t.Fatalf("getFolderAssets: %v", err)
	}
	if total != 3 {
		t.Fatalf("expected 3 assets under /lib/trip (recursive), got %d", total)
	}

	// Pagination: page 1 of size 2 returns 2 items with hasNextPage semantics via total.
	page1, total, err := db.getFolderAssets(ctx, testUserID, "/lib/trip", gpsFilterNoGPS, hiddenFilterVisible, "", "", "", 1, 2)
	if err != nil {
		t.Fatalf("getFolderAssets page1: %v", err)
	}
	if len(page1) != 2 || total != 3 {
		t.Errorf("expected 2 items and total 3, got len=%d total=%d", len(page1), total)
	}
	page2, _, err := db.getFolderAssets(ctx, testUserID, "/lib/trip", gpsFilterNoGPS, hiddenFilterVisible, "", "", "", 2, 2)
	if err != nil {
		t.Fatalf("getFolderAssets page2: %v", err)
	}
	if len(page2) != 1 {
		t.Errorf("expected 1 item on page 2, got %d", len(page2))
	}
}

func TestGetFolderTagFilter(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	db.upsertAssets(ctx, testUserID, []AssetRow{
		extAsset("tagged", "/lib/trip/tagged.jpg"),
		extAsset("untagged", "/lib/trip/untagged.jpg"),
	})
	if err := db.upsertTag(ctx, testUserID, "tag1", "Trip", "Trip", nil, nil); err != nil {
		t.Fatalf("upsertTag: %v", err)
	}
	if err := db.replaceTagAssets(ctx, testUserID, "tag1", []string{"tagged"}); err != nil {
		t.Fatalf("replaceTagAssets: %v", err)
	}

	// Folder assets honor the tag filter (exercises the aliased JOIN path).
	assets, total, err := db.getFolderAssets(ctx, testUserID, "/lib/trip", gpsFilterNoGPS, hiddenFilterVisible, "tag1", "", "", 1, 50)
	if err != nil {
		t.Fatalf("getFolderAssets: %v", err)
	}
	if total != 1 || len(assets) != 1 || assets[0].ImmichID != "tagged" {
		t.Fatalf("expected only the tagged asset, got total=%d assets=%v", total, assets)
	}

	// The tree honors it too.
	tree, err := db.getFolderTree(ctx, testUserID, gpsFilterNoGPS, hiddenFilterVisible, "tag1", "", "")
	if err != nil {
		t.Fatalf("getFolderTree: %v", err)
	}
	node := findNode(tree.Children, "/lib/trip")
	if node == nil || node.AssetCount != 1 {
		t.Errorf("expected /lib/trip count 1 with tag filter, got %+v", node)
	}
}

func TestNeedsOriginalPathBackfill(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	need, err := db.needsOriginalPathBackfill(ctx, testUserID)
	if err != nil {
		t.Fatalf("needsOriginalPathBackfill: %v", err)
	}
	if !need {
		t.Error("expected backfill needed when originalPathBackfillDone is unset")
	}

	if err := db.setSyncState(ctx, testUserID, "originalPathBackfillDone", "true"); err != nil {
		t.Fatalf("setSyncState: %v", err)
	}
	need, err = db.needsOriginalPathBackfill(ctx, testUserID)
	if err != nil {
		t.Fatalf("needsOriginalPathBackfill: %v", err)
	}
	if need {
		t.Error("expected no backfill needed once originalPathBackfillDone=true")
	}
}
