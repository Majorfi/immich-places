package main

import (
	"context"
	"testing"
)

const testNeighborWindow = 6

func TestGetSuggestionsWithSameDayAssets(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()
	svc := newSuggestionService(db, testNeighborWindow)

	dateTime := "2024-06-15T12:00:00Z"
	nearbyTime := "2024-06-15T14:00:00Z"
	farTime := "2024-01-01T12:00:00Z"

	db.upsertAssets(ctx, testUserID, []AssetRow{
		{
			ImmichID: "target", Type: "IMAGE", OriginalFileName: "target.jpg",
			FileCreatedAt:    "2024-06-15T12:00:00Z",
			DateTimeOriginal: &dateTime,
		},
		{
			ImmichID: "nearby", Type: "IMAGE", OriginalFileName: "nearby.jpg",
			FileCreatedAt: nearbyTime,
			Latitude:      ptr(48.85), Longitude: ptr(2.35),
			DateTimeOriginal: &nearbyTime,
		},
		{
			ImmichID: "faraway", Type: "IMAGE", OriginalFileName: "far.jpg",
			FileCreatedAt: farTime,
			Latitude:      ptr(40.71), Longitude: ptr(-74.0),
			DateTimeOriginal: &farTime,
		},
	})

	resp, err := svc.getSuggestions(ctx, testUserID, "target", "")
	if err != nil {
		t.Fatalf("getSuggestions: %v", err)
	}

	if len(resp.SameDayClusters) != 1 {
		t.Errorf("expected 1 same-day cluster, got %d", len(resp.SameDayClusters))
	}
}

func TestGetSuggestionsWithNeighborClusters(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()
	svc := newSuggestionService(db, testNeighborWindow)

	refTime := "2024-06-15T12:00:00Z"
	before2min := "2024-06-15T11:58:00Z"
	after5min := "2024-06-15T12:05:00Z"
	outsideWindow := "2024-06-14T12:00:00Z" // 24h before -> beyond the 6h cap

	db.upsertAssets(ctx, testUserID, []AssetRow{
		{
			ImmichID: "target", Type: "IMAGE", OriginalFileName: "target.jpg",
			FileCreatedAt: refTime, DateTimeOriginal: &refTime,
		},
		{
			ImmichID: "after", Type: "IMAGE", OriginalFileName: "after.jpg",
			FileCreatedAt: after5min, Latitude: ptr(48.86), Longitude: ptr(2.36),
			DateTimeOriginal: &after5min,
		},
		{
			ImmichID: "before", Type: "IMAGE", OriginalFileName: "before.jpg",
			FileCreatedAt: before2min, Latitude: ptr(48.85), Longitude: ptr(2.35),
			DateTimeOriginal: &before2min,
		},
		{
			ImmichID: "outside", Type: "IMAGE", OriginalFileName: "outside.jpg",
			FileCreatedAt: outsideWindow, Latitude: ptr(40.71), Longitude: ptr(-74.0),
			DateTimeOriginal: &outsideWindow,
		},
	})

	resp, err := svc.getSuggestions(ctx, testUserID, "target", "")
	if err != nil {
		t.Fatalf("getSuggestions: %v", err)
	}

	if len(resp.NeighborClusters) != 2 {
		t.Fatalf("expected 2 neighbor points (within window), got %d", len(resp.NeighborClusters))
	}

	// Closest-first ordering: the 2-min-before photo must precede the 5-min-after one.
	first := resp.NeighborClusters[0]
	second := resp.NeighborClusters[1]
	if first.SecondsFromRef == nil || second.SecondsFromRef == nil {
		t.Fatalf("expected SecondsFromRef to be set on neighbor points")
	}
	if *first.SecondsFromRef != -120 {
		t.Errorf("expected first neighbor 2 min before, got %d", *first.SecondsFromRef)
	}
	if *second.SecondsFromRef != 300 {
		t.Errorf("expected second neighbor 5 min after, got %d", *second.SecondsFromRef)
	}
	if first.Count != 1 || second.Count != 1 {
		t.Errorf("expected neighbor points to have count 1, got %d and %d", first.Count, second.Count)
	}
}

func TestGetSuggestionsNeighborClustersEmptyWhenNoneInWindow(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()
	svc := newSuggestionService(db, testNeighborWindow)

	refTime := "2024-06-15T12:00:00Z"
	farTime := "2024-01-01T12:00:00Z"

	db.upsertAssets(ctx, testUserID, []AssetRow{
		{
			ImmichID: "target", Type: "IMAGE", OriginalFileName: "target.jpg",
			FileCreatedAt: refTime, DateTimeOriginal: &refTime,
		},
		{
			ImmichID: "far", Type: "IMAGE", OriginalFileName: "far.jpg",
			FileCreatedAt: farTime, Latitude: ptr(40.71), Longitude: ptr(-74.0),
			DateTimeOriginal: &farTime,
		},
	})

	resp, err := svc.getSuggestions(ctx, testUserID, "target", "")
	if err != nil {
		t.Fatalf("getSuggestions: %v", err)
	}

	if len(resp.NeighborClusters) != 0 {
		t.Errorf("expected no neighbor points outside the window, got %d", len(resp.NeighborClusters))
	}
}

func TestGetSuggestionsAssetNotFound(t *testing.T) {
	db := newTestDB(t)
	svc := newSuggestionService(db, testNeighborWindow)

	_, err := svc.getSuggestions(context.Background(), testUserID, "nonexistent", "")
	if err == nil {
		t.Error("expected error for nonexistent asset")
	}
}

func TestGetSuggestionsWithAlbumClusters(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()
	svc := newSuggestionService(db, testNeighborWindow)

	dateTime := "2024-06-15T12:00:00Z"
	db.upsertAssets(ctx, testUserID, []AssetRow{
		{
			ImmichID: "target", Type: "IMAGE", OriginalFileName: "target.jpg",
			FileCreatedAt: dateTime, DateTimeOriginal: &dateTime,
		},
		{
			ImmichID: "albumAsset1", Type: "IMAGE", OriginalFileName: "a1.jpg",
			FileCreatedAt: dateTime,
			Latitude:      ptr(48.85), Longitude: ptr(2.35),
		},
		{
			ImmichID: "albumAsset2", Type: "IMAGE", OriginalFileName: "a2.jpg",
			FileCreatedAt: dateTime,
			Latitude:      ptr(48.86), Longitude: ptr(2.36),
		},
	})

	db.upsertAlbum(ctx, testUserID, "testAlbum", "Test Album", nil, 2, dateTime, nil)
	db.replaceAlbumAssets(ctx, testUserID, "testAlbum", []string{"albumAsset1", "albumAsset2"})

	resp, err := svc.getSuggestions(ctx, testUserID, "target", "testAlbum")
	if err != nil {
		t.Fatalf("getSuggestions with album: %v", err)
	}

	if len(resp.AlbumClusters) == 0 {
		t.Error("expected album clusters, got none")
	}
}

func TestMostFrequentLabel(t *testing.T) {
	tests := []struct {
		name     string
		hits     map[string]int
		expected string
	}{
		{"empty map", map[string]int{}, ""},
		{"single entry", map[string]int{"Paris": 5}, "Paris"},
		{"multiple entries", map[string]int{"Paris": 5, "London": 10, "Berlin": 3}, "London"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := mostFrequentLabel(tt.hits)
			if result != tt.expected {
				t.Errorf("expected %q, got %q", tt.expected, result)
			}
		})
	}
}

func TestBuildMetadataLabel(t *testing.T) {
	tests := []struct {
		name     string
		city     *string
		state    *string
		country  *string
		expected string
	}{
		{"all nil", nil, nil, nil, ""},
		{"city only", ptr("Paris"), nil, nil, "Paris"},
		{"full address", ptr("Paris"), ptr("IDF"), ptr("France"), "Paris, IDF, France"},
		{"country only", nil, nil, ptr("France"), "France"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := buildMetadataLabel(tt.city, tt.state, tt.country)
			if result != tt.expected {
				t.Errorf("expected %q, got %q", tt.expected, result)
			}
		})
	}
}

func TestAlbumClusterCacheHit(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()
	svc := newSuggestionService(db, testNeighborWindow)

	dateTime := "2024-06-15T12:00:00Z"
	db.upsertAssets(ctx, testUserID, []AssetRow{{
		ImmichID: "a1", Type: "IMAGE", OriginalFileName: "a1.jpg",
		FileCreatedAt: dateTime, Latitude: ptr(48.85), Longitude: ptr(2.35),
	}})
	db.upsertAlbum(ctx, testUserID, "testAlbum", "Test", nil, 1, dateTime, nil)
	db.replaceAlbumAssets(ctx, testUserID, "testAlbum", []string{"a1"})

	clusters1 := svc.clusterAlbumAssets(ctx, testUserID, "testAlbum")
	clusters2 := svc.clusterAlbumAssets(ctx, testUserID, "testAlbum")

	if len(clusters1) != len(clusters2) {
		t.Errorf("expected same clusters on cache hit, got %d vs %d", len(clusters1), len(clusters2))
	}
}

func TestGetSuggestionsNoDateTimeOriginal(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()
	svc := newSuggestionService(db, testNeighborWindow)

	db.upsertAssets(ctx, testUserID, []AssetRow{{
		ImmichID: "target", Type: "IMAGE", OriginalFileName: "target.jpg",
		FileCreatedAt: "2024-06-15T12:00:00Z",
	}})

	resp, err := svc.getSuggestions(ctx, testUserID, "target", "")
	if err != nil {
		t.Fatalf("getSuggestions without dateTimeOriginal: %v", err)
	}
	if resp.SameDayClusters == nil {
		t.Error("expected initialized sameDayClusters")
	}
}

func TestGetSuggestionsWithFrequentLocations(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()
	svc := newSuggestionService(db, testNeighborWindow)

	db.replaceFrequentLocations(ctx, testUserID, []FrequentLocationRow{
		{Latitude: 48.85, Longitude: 2.35, Label: "Paris, France", AssetCount: 100},
		{Latitude: 40.71, Longitude: -74.0, Label: "New York, USA", AssetCount: 50},
	})

	dateTime := "2024-06-15T12:00:00Z"
	db.upsertAssets(ctx, testUserID, []AssetRow{{
		ImmichID: "target", Type: "IMAGE", OriginalFileName: "target.jpg",
		FileCreatedAt: dateTime, DateTimeOriginal: &dateTime,
	}})

	resp, err := svc.getSuggestions(ctx, testUserID, "target", "")
	if err != nil {
		t.Fatalf("getSuggestions: %v", err)
	}

	if len(resp.FrequentLocations) != 2 {
		t.Errorf("expected 2 frequent locations, got %d", len(resp.FrequentLocations))
	}
}
