package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sort"
	"strings"
	"testing"
	"time"
)

func seedTypedAsset(t *testing.T, db *Database, ID, assetType string, lat, lon *float64, fileCreatedAt string) {
	t.Helper()
	err := db.upsertAssets(context.Background(), testUserID, []AssetRow{{
		ImmichID:         ID,
		Type:             assetType,
		OriginalFileName: ID,
		FileCreatedAt:    fileCreatedAt,
		DateTimeOriginal: &fileCreatedAt,
		Latitude:         lat,
		Longitude:        lon,
	}})
	if err != nil {
		t.Fatalf("failed to seed asset %s: %v", ID, err)
	}
}

func searchResponseWithTypes(items map[string]string) ImmichSearchResponse {
	var sr ImmichSearchResponse
	for ID, assetType := range items {
		sr.Assets.Items = append(sr.Assets.Items, ImmichAssetResponse{ID: ID, Type: assetType, FileCreatedAt: "2024-01-01T12:00:00Z"})
	}
	return sr
}

func TestSyncAssetsKeepsImagesAndVideosOnly(t *testing.T) {
	factory, immich := newMockImmichFactory(t, func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Type *string `json:"type"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Errorf("decode request body: %v", err)
		}
		if body.Type != nil {
			t.Errorf("asset search must not restrict the type, got %q", *body.Type)
		}
		json.NewEncoder(w).Encode(searchResponseWithTypes(map[string]string{
			"photo": immichAssetTypeImage, "clip": immichAssetTypeVideo, "song": "AUDIO", "blob": "OTHER",
		}))
	})

	db := newTestDB(t)
	svc := newSyncService(db, factory, newNominatimClient(10*time.Second))
	syncedIDs, count, err := svc.syncAssets(context.Background(), testUserID, immich, nil, "test")
	if err != nil {
		t.Fatalf("syncAssets: %v", err)
	}
	sort.Strings(syncedIDs)
	if count != 2 || strings.Join(syncedIDs, ",") != "clip,photo" {
		t.Errorf("expected photo and clip only, got count=%d IDs=%v", count, syncedIDs)
	}
}

func TestSearchAssetIDsSkipsUnsupportedTypes(t *testing.T) {
	_, immich := newMockImmichFactory(t, func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(searchResponseWithTypes(map[string]string{
			"photo": immichAssetTypeImage, "clip": immichAssetTypeVideo, "song": "AUDIO",
		}))
	})

	IDs, err := immich.getAlbumAssetIDs(context.Background(), "album1")
	if err != nil {
		t.Fatalf("getAlbumAssetIDs: %v", err)
	}
	sort.Strings(IDs)
	if strings.Join(IDs, ",") != "clip,photo" {
		t.Errorf("expected photo and clip only, got %v", IDs)
	}
}

func TestMediaTypeFilter(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	seedTypedAsset(t, db, "photoNoGPS", immichAssetTypeImage, nil, nil, "2024-01-01T12:00:00Z")
	seedTypedAsset(t, db, "videoNoGPS", immichAssetTypeVideo, nil, nil, "2024-01-02T12:00:00Z")
	seedTypedAsset(t, db, "photoGPS", immichAssetTypeImage, ptr(48.85), ptr(2.35), "2024-01-03T12:00:00Z")
	seedTypedAsset(t, db, "videoGPS", immichAssetTypeVideo, ptr(40.71), ptr(-74.0), "2024-01-04T12:00:00Z")
	db.upsertAlbum(ctx, testUserID, "album1", "Trip", nil, 4, "2024-01-01T00:00:00Z", nil)
	db.replaceAlbumAssets(ctx, testUserID, "album1", []string{"photoNoGPS", "videoNoGPS", "photoGPS", "videoGPS"})

	tests := []struct {
		mediaType      string
		wantMissing    int
		wantMarkers    int
		wantAlbumNoGPS int
	}{
		{mediaTypeAll, 2, 2, 2},
		{mediaTypeImage, 1, 1, 1},
		{mediaTypeVideo, 1, 1, 1},
	}

	for _, tt := range tests {
		t.Run(tt.mediaType, func(t *testing.T) {
			missing, err := db.countFilteredAssets(ctx, testUserID, "", "", gpsFilterNoGPS, hiddenFilterVisible, "", "", tt.mediaType)
			if err != nil {
				t.Fatalf("countFilteredAssets: %v", err)
			}
			if missing != tt.wantMissing {
				t.Errorf("missing-location count: expected %d, got %d", tt.wantMissing, missing)
			}

			inAlbum, err := db.countFilteredAssets(ctx, testUserID, "album1", "", gpsFilterNoGPS, hiddenFilterVisible, "", "", tt.mediaType)
			if err != nil {
				t.Fatalf("countFilteredAssets album: %v", err)
			}
			if inAlbum != tt.wantMissing {
				t.Errorf("album missing-location count: expected %d, got %d", tt.wantMissing, inAlbum)
			}

			markers, err := db.getMapMarkers(ctx, testUserID, "", "", "", "", nil, maxMapMarkers, tt.mediaType)
			if err != nil {
				t.Fatalf("getMapMarkers: %v", err)
			}
			if len(markers) != tt.wantMarkers {
				t.Errorf("markers: expected %d, got %d", tt.wantMarkers, len(markers))
			}

			albums, err := db.getAlbumsByGPSFilter(ctx, testUserID, gpsFilterNoGPS, "", "", tt.mediaType)
			if err != nil {
				t.Fatalf("getAlbumsByGPSFilter: %v", err)
			}
			if len(albums) != 1 || albums[0].FilteredCount != tt.wantAlbumNoGPS {
				t.Errorf("album filtered count: expected %d, got %+v", tt.wantAlbumNoGPS, albums)
			}

		})
	}
}

func TestMediaTypeParamValidation(t *testing.T) {
	_, mux := newTestHandlers(t)

	tests := []struct {
		query  string
		status int
	}{
		{"/assets?mediaType=video", 200},
		{"/assets?mediaType=image", 200},
		{"/assets?mediaType=all", 200},
		{"/assets", 200},
		{"/assets?mediaType=audio", 400},
		{"/map-markers?mediaType=gif", 400},
	}

	for _, tt := range tests {
		t.Run(tt.query, func(t *testing.T) {
			rec := httptest.NewRecorder()
			mux.ServeHTTP(rec, withTestUser(httptest.NewRequest("GET", tt.query, nil)))
			if rec.Code != tt.status {
				t.Errorf("expected %d, got %d (body: %s)", tt.status, rec.Code, rec.Body.String())
			}
		})
	}
}
