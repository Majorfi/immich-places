package main

import (
	"context"
	"fmt"
	"testing"
)

type gridTestPoint struct {
	ID  string
	lat float64
	lon float64
}

func TestGetMapMarkersKeepsSparsePlacesUnderLimit(t *testing.T) {
	europe := &TViewportBounds{North: 50, South: 35, East: 25, West: -5}
	europeSparse := []gridTestPoint{{ID: "barcelona", lat: 41.39, lon: 2.17}, {ID: "bari", lat: 41.12, lon: 16.87}}
	rome := gridTestPoint{lat: 41.9, lon: 12.5}

	tests := []struct {
		name    string
		bounds  *TViewportBounds
		limit   int
		inAlbum bool
		dense   gridTestPoint
		sparse  []gridTestPoint
	}{
		{
			name:   "old cities next to a busy recent one",
			bounds: europe,
			limit:  25,
			dense:  rome,
			sparse: europeSparse,
		},
		{
			name:    "album filter",
			bounds:  europe,
			limit:   25,
			inAlbum: true,
			dense:   rome,
			sparse:  europeSparse,
		},
		{
			name:   "zoomed out past the world width",
			bounds: &TViewportBounds{North: 85, South: -85, East: 1000, West: -1000},
			limit:  16,
			dense:  gridTestPoint{lat: 48.85, lon: 2.35},
			sparse: []gridTestPoint{{ID: "montreal", lat: 45.5, lon: -73.57}},
		},
		{
			name:   "wrapped viewport across the antimeridian",
			bounds: &TViewportBounds{North: 10, South: 0, East: -170, West: 170},
			limit:  9,
			dense:  gridTestPoint{lat: 5, lon: 175},
			sparse: []gridTestPoint{{ID: "fiji", lat: 5, lon: -175}},
		},
		{
			name:   "cells on both sides of zero",
			bounds: &TViewportBounds{North: 1, South: -1, East: 1, West: -1},
			limit:  9,
			dense:  gridTestPoint{lat: 0.5, lon: 0.5},
			sparse: []gridTestPoint{{ID: "south", lat: -0.5, lon: 0.5}},
		},
		{
			name:   "no bounds",
			limit:  9,
			dense:  gridTestPoint{lat: 48.85, lon: 2.35},
			sparse: []gridTestPoint{{ID: "sydney", lat: -33.87, lon: 151.21}},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			db := newTestDB(t)
			ctx := context.Background()

			var assetIDs []string
			for i, point := range tt.sparse {
				seedAsset(t, db, point.ID, ptr(point.lat), ptr(point.lon), fmt.Sprintf("2020-01-0%dT12:00:00Z", i+1))
				assetIDs = append(assetIDs, point.ID)
			}
			for i := range tt.limit * 2 {
				denseID := fmt.Sprintf("dense%d", i)
				seedAsset(t, db, denseID, ptr(tt.dense.lat), ptr(tt.dense.lon), fmt.Sprintf("2024-01-01T12:%02d:00Z", i))
				assetIDs = append(assetIDs, denseID)
			}

			albumID := ""
			if tt.inAlbum {
				albumID = "album1"
				db.upsertAlbum(ctx, testUserID, albumID, "Trip", nil, len(assetIDs), "2024-01-01T00:00:00Z", nil)
				db.replaceAlbumAssets(ctx, testUserID, albumID, assetIDs)
			}

			markers, err := db.getMapMarkers(ctx, testUserID, albumID, "", "", "", tt.bounds, tt.limit)
			if err != nil {
				t.Fatalf("getMapMarkers: %v", err)
			}
			if len(markers) != tt.limit {
				t.Errorf("expected %d markers, got %d", tt.limit, len(markers))
			}
			returned := map[string]bool{}
			for _, marker := range markers {
				returned[marker.ImmichID] = true
			}
			for _, point := range tt.sparse {
				if !returned[point.ID] {
					t.Errorf("sparse place %s was dropped by the limit", point.ID)
				}
			}
		})
	}
}
