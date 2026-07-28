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

func TestGetFolderTreeExternalScopeAndCounts(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	db.upsertAssets(ctx, testUserID, []AssetRow{
		extAsset("a", "/mnt/photos/2023/Vacation/a.jpg"),
		extAsset("b", "/mnt/photos/2023/Vacation/b.jpg"),
		extAsset("c", "/mnt/photos/2023/Birthday/c.jpg"),
		// Uploaded asset (no libraryID) must be excluded from the folder view.
		{
			ImmichID: "up", Type: "IMAGE", OriginalFileName: "up.jpg",
			OriginalPath:  "/usr/src/app/upload/library/uuid/2026/2026-01-01/up.jpg",
			FileCreatedAt: "2024-01-01T00:00:00Z",
		},
	})

	tree, err := db.getFolderTree(ctx, testUserID, false, hiddenFilterVisible)
	if err != nil {
		t.Fatalf("getFolderTree: %v", err)
	}

	if findNode(tree.Children, "/usr") != nil {
		t.Error("uploaded asset (libraryID NULL) must not appear in the folder tree")
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

// A folder named "my_photos" must not match sibling "myXphotos": the '_' is a LIKE
// wildcard and must be escaped.
func TestGetFolderAssetsLikeWildcardEscaped(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	db.upsertAssets(ctx, testUserID, []AssetRow{
		extAsset("inside", "/lib/my_photos/inside.jpg"),
		extAsset("sibling", "/lib/myXphotos/sibling.jpg"),
	})

	assets, total, err := db.getFolderAssets(ctx, testUserID, "/lib/my_photos", false, hiddenFilterVisible, 1, 50)
	if err != nil {
		t.Fatalf("getFolderAssets: %v", err)
	}
	if total != 1 || len(assets) != 1 {
		t.Fatalf("expected exactly 1 asset in /lib/my_photos, got total=%d len=%d", total, len(assets))
	}
	if assets[0].ImmichID != "inside" {
		t.Errorf("expected 'inside', got %q (LIKE wildcard '_' was not escaped)", assets[0].ImmichID)
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
	_, total, err := db.getFolderAssets(ctx, testUserID, "/lib/trip", false, hiddenFilterVisible, 1, 50)
	if err != nil {
		t.Fatalf("getFolderAssets: %v", err)
	}
	if total != 3 {
		t.Fatalf("expected 3 assets under /lib/trip (recursive), got %d", total)
	}

	// Pagination: page 1 of size 2 returns 2 items with hasNextPage semantics via total.
	page1, total, err := db.getFolderAssets(ctx, testUserID, "/lib/trip", false, hiddenFilterVisible, 1, 2)
	if err != nil {
		t.Fatalf("getFolderAssets page1: %v", err)
	}
	if len(page1) != 2 || total != 3 {
		t.Errorf("expected 2 items and total 3, got len=%d total=%d", len(page1), total)
	}
	page2, _, err := db.getFolderAssets(ctx, testUserID, "/lib/trip", false, hiddenFilterVisible, 2, 2)
	if err != nil {
		t.Fatalf("getFolderAssets page2: %v", err)
	}
	if len(page2) != 1 {
		t.Errorf("expected 1 item on page 2, got %d", len(page2))
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
