package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

var testAPIKey = "test-immich-api-key"

var testUser = &UserRow{
	ID:           testUserID,
	Email:        "test@example.com",
	ImmichAPIKey: &testAPIKey,
}

func withTestUser(r *http.Request) *http.Request {
	return r.WithContext(context.WithValue(r.Context(), userContextKey, testUser))
}

func newTestHandlers(t *testing.T) (*Handlers, *http.ServeMux) {
	t.Helper()
	db := newTestDB(t)
	factory := &ImmichClientFactory{
		baseURL:    "http://fake:2283",
		httpClient: &http.Client{Timeout: 5 * time.Second},
	}
	syncService := newSyncService(db, factory, newNominatimClient())
	syncService.shutdownCtx = context.Background()
	suggestions := newSuggestionService(db)
	handlers := newHandlers(db, factory, "http://external:2283", syncService, suggestions, nil)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", handlers.handleHealth)
	mux.HandleFunc("GET /assets", handlers.handleGetAssets)
	mux.HandleFunc("GET /albums", handlers.handleGetAlbums)
	mux.HandleFunc("GET /map-markers", handlers.handleGetMapMarkers)
	mux.HandleFunc("PUT /assets/{assetID}/location", handlers.handleUpdateLocation)
	mux.HandleFunc("PUT /assets/{assetID}/hidden", handlers.handleUpdateHidden)
	mux.HandleFunc("PUT /assets/bulk-hidden", handlers.handleBulkUpdateHidden)
	mux.HandleFunc("GET /assets/{assetID}/page-info", handlers.handleGetAssetPageInfo)
	mux.HandleFunc("GET /sync/status", handlers.handleSyncStatus)
	mux.HandleFunc("GET /assets/{assetID}/thumbnail", handlers.handleGetThumbnail)
	mux.HandleFunc("GET /assets/{assetID}/suggestions", handlers.handleGetSuggestions)
	mux.HandleFunc("POST /sync", handlers.handleTriggerSync)

	return handlers, mux
}

func TestHealthEndpoint(t *testing.T) {
	_, mux := newTestHandlers(t)

	req := httptest.NewRequest("GET", "/health", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var resp HealthResponse
	json.NewDecoder(rec.Body).Decode(&resp)
	if resp.Status != "ok" {
		t.Errorf("expected status ok, got %s", resp.Status)
	}
	if resp.ImmichURL != "http://external:2283" {
		t.Errorf("expected external URL, got %s", resp.ImmichURL)
	}
}

func TestAssetsEndpointReturnsEmptyList(t *testing.T) {
	_, mux := newTestHandlers(t)

	req := withTestUser(httptest.NewRequest("GET", "/assets?page=1&pageSize=10", nil))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var resp PaginatedAssets
	json.NewDecoder(rec.Body).Decode(&resp)
	if resp.Total != 0 {
		t.Errorf("expected 0 total, got %d", resp.Total)
	}
	if len(resp.Items) != 0 {
		t.Errorf("expected 0 items, got %d", len(resp.Items))
	}
}

func TestMapMarkersBoundsValidation(t *testing.T) {
	_, mux := newTestHandlers(t)

	tests := []struct {
		name   string
		query  string
		status int
	}{
		{"no bounds returns 200", "/map-markers", 200},
		{"valid bounds returns 200", "/map-markers?north=50&south=40&east=10&west=-5", 200},
		{"partial bounds returns 400", "/map-markers?north=50&south=40", 400},
		{"non-numeric returns 400", "/map-markers?north=abc&south=40&east=10&west=-5", 400},
		{"lat out of range returns 400", "/map-markers?north=100&south=40&east=10&west=-5", 400},
		{"wrapped longitude is accepted", "/map-markers?north=50&south=40&east=200&west=-5", 200},
		{"non-finite returns 400", "/map-markers?north=50&south=40&east=NaN&west=-5", 400},
		{"south > north returns 400", "/map-markers?north=30&south=50&east=10&west=-5", 400},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := withTestUser(httptest.NewRequest("GET", tt.query, nil))
			rec := httptest.NewRecorder()
			mux.ServeHTTP(rec, req)

			if rec.Code != tt.status {
				t.Errorf("expected %d, got %d (body: %s)", tt.status, rec.Code, rec.Body.String())
			}
		})
	}
}

func TestMapMarkersLimitValidation(t *testing.T) {
	_, mux := newTestHandlers(t)

	tests := []struct {
		name   string
		query  string
		status int
	}{
		{"valid limit returns 200", "/map-markers?limit=10000", 200},
		{"non-numeric limit returns 400", "/map-markers?limit=abc", 400},
		{"negative limit returns 400", "/map-markers?limit=-1", 400},
		{"zero limit returns 400", "/map-markers?limit=0", 400},
		{"too large limit is clamped to max", "/map-markers?limit=100001", 200},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := withTestUser(httptest.NewRequest("GET", tt.query, nil))
			rec := httptest.NewRecorder()
			mux.ServeHTTP(rec, req)

			if rec.Code != tt.status {
				t.Errorf("expected %d, got %d (body: %s)", tt.status, rec.Code, rec.Body.String())
			}
		})
	}
}

func TestMapMarkersLimitApplied(t *testing.T) {
	handlers, mux := newTestHandlers(t)
	d := handlers.db.(*Database)
	seedAsset(t, d, "a1", ptr(48.85), ptr(2.35), "2024-01-01T12:00:00Z")
	seedAsset(t, d, "a2", ptr(40.71), ptr(-74.0), "2024-01-02T12:00:00Z")

	req := withTestUser(httptest.NewRequest("GET", "/map-markers?limit=1", nil))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", rec.Code, rec.Body.String())
	}

	var markers []MapMarker
	if err := json.NewDecoder(rec.Body).Decode(&markers); err != nil {
		t.Fatalf("decode map markers response: %v", err)
	}
	if len(markers) != 1 {
		t.Errorf("expected 1 marker in response body due to limit=1, got %d", len(markers))
	}
}

func TestLocationUpdateValidation(t *testing.T) {
	_, mux := newTestHandlers(t)

	tests := []struct {
		name   string
		body   string
		status int
	}{
		{"empty body returns 400", "", 400},
		{"invalid JSON returns 400", "{bad}", 400},
		{"lat out of range returns 400", `{"latitude":100,"longitude":2}`, 400},
		{"lon out of range returns 400", `{"latitude":48,"longitude":200}`, 400},
		{"unknown fields returns 400", `{"latitude":48,"longitude":2,"extra":true}`, 400},
		{"missing longitude returns 400", `{"latitude":48}`, 400},
		{"missing both returns 400", `{}`, 400},
		{"null values returns 400", `{"latitude":null,"longitude":null}`, 400},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := withTestUser(httptest.NewRequest("PUT", "/assets/00000000-0000-0000-0000-000000000001/location", strings.NewReader(tt.body)))
			req.Header.Set("Content-Type", "application/json")
			rec := httptest.NewRecorder()
			mux.ServeHTTP(rec, req)

			if rec.Code != tt.status {
				t.Errorf("expected %d, got %d (body: %s)", tt.status, rec.Code, rec.Body.String())
			}
		})
	}
}

func TestAssetPageInfoNotFound(t *testing.T) {
	_, mux := newTestHandlers(t)

	req := withTestUser(httptest.NewRequest("GET", "/assets/00000000-0000-0000-0000-000000000099/page-info?pageSize=20", nil))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", rec.Code)
	}
}

func TestSyncStatusEndpoint(t *testing.T) {
	_, mux := newTestHandlers(t)

	req := withTestUser(httptest.NewRequest("GET", "/sync/status", nil))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var resp SyncStatusResponse
	json.NewDecoder(rec.Body).Decode(&resp)
	if resp.Syncing {
		t.Error("expected syncing=false")
	}
}

func TestAssetIDUUIDValidation(t *testing.T) {
	_, mux := newTestHandlers(t)

	tests := []struct {
		name   string
		path   string
		status int
	}{
		{"valid UUID", "/assets/550e8400-e29b-41d4-a716-446655440000/page-info", 404},
		{"non-UUID string", "/assets/not-a-uuid/page-info", 400},
		{"numeric ID", "/assets/12345/page-info", 400},
		{"UUID-like with slash", "/assets/550e8400-e29b-41d4-a716-4466/page-info", 400},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := withTestUser(httptest.NewRequest("GET", tt.path, nil))
			rec := httptest.NewRecorder()
			mux.ServeHTTP(rec, req)

			if rec.Code != tt.status {
				t.Errorf("expected %d, got %d (body: %s)", tt.status, rec.Code, rec.Body.String())
			}
		})
	}
}

func TestSuggestionsReturns404ForMissingAsset(t *testing.T) {
	_, mux := newTestHandlers(t)

	req := withTestUser(httptest.NewRequest("GET", "/assets/00000000-0000-0000-0000-000000000099/suggestions", nil))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d (body: %s)", rec.Code, rec.Body.String())
	}
}

func TestPaginationValidation(t *testing.T) {
	_, mux := newTestHandlers(t)

	tests := []struct {
		name   string
		query  string
		status int
	}{
		{"valid params", "/assets?page=1&pageSize=10", 200},
		{"defaults without params", "/assets", 200},
		{"non-numeric page", "/assets?page=abc", 400},
		{"non-numeric pageSize", "/assets?pageSize=abc", 400},
		{"page zero", "/assets?page=0", 400},
		{"pageSize too large", "/assets?pageSize=10001", 400},
		{"pageSize max allowed", "/assets?pageSize=10000", 200},
		{"negative pageSize", "/assets?pageSize=-1", 400},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := withTestUser(httptest.NewRequest("GET", tt.query, nil))
			rec := httptest.NewRecorder()
			mux.ServeHTTP(rec, req)

			if rec.Code != tt.status {
				t.Errorf("expected %d, got %d (body: %s)", tt.status, rec.Code, rec.Body.String())
			}
		})
	}
}

func TestAtomicSyncStart(t *testing.T) {
	handlers, mux := newTestHandlers(t)

	handlers.syncService.mu.Lock()
	handlers.syncService.userSyncing[testUserID] = true
	handlers.syncService.mu.Unlock()

	req := withTestUser(httptest.NewRequest("POST", "/sync", nil))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected 200 for already syncing, got %d", rec.Code)
	}

	var resp map[string]string
	json.NewDecoder(rec.Body).Decode(&resp)
	if resp["status"] != "already syncing" {
		t.Errorf("expected 'already syncing', got '%s'", resp["status"])
	}
}

func newTestHandlersWithMockImmich(t *testing.T, immichHandler http.HandlerFunc) (*Handlers, *http.ServeMux) {
	t.Helper()
	db := newTestDB(t)
	server := httptest.NewServer(immichHandler)
	t.Cleanup(server.Close)
	factory := &ImmichClientFactory{
		baseURL:    server.URL,
		httpClient: &http.Client{Timeout: 5 * time.Second},
	}
	syncService := newSyncService(db, factory, newNominatimClient())
	syncService.shutdownCtx = context.Background()
	suggestions := newSuggestionService(db)
	handlers := newHandlers(db, factory, "http://external:2283", syncService, suggestions, nil)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", handlers.handleHealth)
	mux.HandleFunc("GET /assets", handlers.handleGetAssets)
	mux.HandleFunc("GET /albums", handlers.handleGetAlbums)
	mux.HandleFunc("GET /map-markers", handlers.handleGetMapMarkers)
	mux.HandleFunc("PUT /assets/{assetID}/location", handlers.handleUpdateLocation)
	mux.HandleFunc("PUT /assets/{assetID}/hidden", handlers.handleUpdateHidden)
	mux.HandleFunc("PUT /assets/bulk-hidden", handlers.handleBulkUpdateHidden)
	mux.HandleFunc("GET /assets/{assetID}/page-info", handlers.handleGetAssetPageInfo)
	mux.HandleFunc("GET /sync/status", handlers.handleSyncStatus)
	mux.HandleFunc("GET /assets/{assetID}/thumbnail", handlers.handleGetThumbnail)
	mux.HandleFunc("GET /assets/{assetID}/preview", handlers.handleGetPreview)
	mux.HandleFunc("GET /assets/{assetID}/suggestions", handlers.handleGetSuggestions)
	mux.HandleFunc("GET /frequent-locations", handlers.handleGetFrequentLocations)
	mux.HandleFunc("POST /sync", handlers.handleTriggerSync)

	return handlers, mux
}

func TestHandleGetThumbnail(t *testing.T) {
	handlers, mux := newTestHandlersWithMockImmich(t, func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "/thumbnail") {
			w.Header().Set("Content-Type", "image/jpeg")
			w.Write([]byte("fake-image-data"))
			return
		}
		http.NotFound(w, r)
	})
	seedAsset(t, handlers.db.(*Database), "00000000-0000-0000-0000-000000000001", ptr(48.85), ptr(2.35), "2024-01-01T12:00:00Z")

	req := withTestUser(httptest.NewRequest("GET", "/assets/00000000-0000-0000-0000-000000000001/thumbnail", nil))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	if rec.Header().Get("Content-Type") != "image/jpeg" {
		t.Errorf("expected image/jpeg, got %s", rec.Header().Get("Content-Type"))
	}
	if rec.Header().Get("Cache-Control") != "private, max-age=86400" {
		t.Errorf("expected private cache-control, got %s", rec.Header().Get("Cache-Control"))
	}
	if rec.Body.String() != "fake-image-data" {
		t.Errorf("expected proxied body")
	}
}

func TestHandleGetPreview(t *testing.T) {
	handlers, mux := newTestHandlersWithMockImmich(t, func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "/thumbnail") {
			w.Header().Set("Content-Type", "image/webp")
			w.Write([]byte("fake-preview"))
			return
		}
		http.NotFound(w, r)
	})
	seedAsset(t, handlers.db.(*Database), "00000000-0000-0000-0000-000000000001", ptr(48.85), ptr(2.35), "2024-01-01T12:00:00Z")

	req := withTestUser(httptest.NewRequest("GET", "/assets/00000000-0000-0000-0000-000000000001/preview", nil))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	if rec.Body.String() != "fake-preview" {
		t.Errorf("expected proxied preview body")
	}
}

func TestHandleGetThumbnailInvalidUUID(t *testing.T) {
	_, mux := newTestHandlers(t)

	req := withTestUser(httptest.NewRequest("GET", "/assets/not-a-uuid/thumbnail", nil))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rec.Code)
	}
}

func TestHandleGetFrequentLocations(t *testing.T) {
	handlers, mux := newTestHandlersWithMockImmich(t, func(w http.ResponseWriter, r *http.Request) {
		http.NotFound(w, r)
	})

	ctx := context.Background()
	handlers.db.(*Database).replaceFrequentLocations(ctx, testUserID, []FrequentLocationRow{
		{Latitude: 48.85, Longitude: 2.35, Label: "Paris, France", AssetCount: 100},
		{Latitude: 40.71, Longitude: -74.0, Label: "New York, USA", AssetCount: 50},
	})

	req := withTestUser(httptest.NewRequest("GET", "/frequent-locations", nil))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var clusters []LocationCluster
	json.NewDecoder(rec.Body).Decode(&clusters)
	if len(clusters) != 2 {
		t.Errorf("expected 2 clusters, got %d", len(clusters))
	}
}

func TestHandleUpdateLocationSuccess(t *testing.T) {
	handlers, mux := newTestHandlersWithMockImmich(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "PUT" && r.URL.Path == "/api/assets" {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		http.NotFound(w, r)
	})

	ctx := context.Background()
	handlers.db.(*Database).upsertAssets(ctx, testUserID, []AssetRow{{
		ImmichID:         "00000000-0000-0000-0000-000000000001",
		Type:             "IMAGE",
		OriginalFileName: "test.jpg",
		FileCreatedAt:    "2024-01-01T12:00:00Z",
	}})

	req := withTestUser(httptest.NewRequest("PUT", "/assets/00000000-0000-0000-0000-000000000001/location",
		strings.NewReader(`{"latitude":48.85,"longitude":2.35}`)))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", rec.Code, rec.Body.String())
	}
}

func TestHandleUpdateLocationImmichFailure(t *testing.T) {
	handlers, mux := newTestHandlersWithMockImmich(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "PUT" && r.URL.Path == "/api/assets" {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		http.NotFound(w, r)
	})

	ctx := context.Background()
	handlers.db.(*Database).upsertAssets(ctx, testUserID, []AssetRow{{
		ImmichID:         "00000000-0000-0000-0000-000000000001",
		Type:             "IMAGE",
		OriginalFileName: "test.jpg",
		FileCreatedAt:    "2024-01-01T12:00:00Z",
	}})

	req := withTestUser(httptest.NewRequest("PUT", "/assets/00000000-0000-0000-0000-000000000001/location",
		strings.NewReader(`{"latitude":48.85,"longitude":2.35}`)))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadGateway {
		t.Errorf("expected 502 for Immich failure, got %d", rec.Code)
	}
}

func TestHandleAlbumsWithGPSFilter(t *testing.T) {
	handlers, mux := newTestHandlersWithMockImmich(t, func(w http.ResponseWriter, r *http.Request) {
		http.NotFound(w, r)
	})

	ctx := context.Background()
	d := handlers.db.(*Database)
	seedAsset(t, d, "a1", ptr(48.85), ptr(2.35), "2024-01-01T12:00:00Z")
	d.upsertAlbum(ctx, testUserID, "album1", "Test", nil, 1, "2024-01-01T00:00:00Z", nil)
	d.replaceAlbumAssets(ctx, testUserID, "album1", []string{"a1"})

	req := withTestUser(httptest.NewRequest("GET", "/albums?gpsFilter=with-gps", nil))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var albums []AlbumRow
	json.NewDecoder(rec.Body).Decode(&albums)
	if len(albums) != 1 {
		t.Errorf("expected 1 album with GPS, got %d", len(albums))
	}
}

func TestHandleUpdateLocationWithStack(t *testing.T) {
	handlers, mux := newTestHandlersWithMockImmich(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "PUT" && r.URL.Path == "/api/assets" {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		http.NotFound(w, r)
	})

	ctx := context.Background()
	d := handlers.db.(*Database)
	d.upsertAssets(ctx, testUserID, []AssetRow{
		{
			ImmichID: "00000000-0000-0000-0000-000000000001", Type: "IMAGE",
			OriginalFileName: "s1.jpg", FileCreatedAt: "2024-01-01T12:00:00Z",
		},
		{
			ImmichID: "00000000-0000-0000-0000-000000000002", Type: "IMAGE",
			OriginalFileName: "s2.jpg", FileCreatedAt: "2024-01-02T12:00:00Z",
		},
	})
	d.batchUpdateStackInfo(ctx, testUserID, []stackUpdateRow{
		{immichID: "00000000-0000-0000-0000-000000000001", stackID: "stack1", assetCount: 2},
		{immichID: "00000000-0000-0000-0000-000000000002", stackID: "stack1",
			primaryAssetID: ptr("00000000-0000-0000-0000-000000000001"), assetCount: 2},
	})

	req := withTestUser(httptest.NewRequest("PUT", "/assets/00000000-0000-0000-0000-000000000001/location",
		strings.NewReader(`{"latitude":48.85,"longitude":2.35}`)))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", rec.Code, rec.Body.String())
	}

	asset, _ := d.getAssetByID(ctx, testUserID, "00000000-0000-0000-0000-000000000002")
	if asset == nil || asset.Latitude == nil || *asset.Latitude != 48.85 {
		t.Error("expected stack member to have updated location")
	}
}

func TestHandleGetPreviewError(t *testing.T) {
	handlers, mux := newTestHandlersWithMockImmich(t, func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "not found", http.StatusNotFound)
	})
	seedAsset(t, handlers.db.(*Database), "00000000-0000-0000-0000-000000000001", ptr(48.85), ptr(2.35), "2024-01-01T12:00:00Z")

	req := withTestUser(httptest.NewRequest("GET", "/assets/00000000-0000-0000-0000-000000000001/preview", nil))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Errorf("expected proxied 404, got %d", rec.Code)
	}
}

func TestHandleGetThumbnailHiddenLibraryAssetReturnsNotFound(t *testing.T) {
	handlers, mux := newTestHandlersWithMockImmich(t, func(w http.ResponseWriter, r *http.Request) {
		http.NotFound(w, r)
	})

	ctx := context.Background()
	if err := handlers.db.(*Database).upsertAssets(ctx, testUserID, []AssetRow{{
		ImmichID:         "00000000-0000-0000-0000-000000000001",
		Type:             "IMAGE",
		OriginalFileName: "test.jpg",
		FileCreatedAt:    "2024-01-01T12:00:00Z",
		LibraryID:        ptr("lib1"),
	}}); err != nil {
		t.Fatalf("upsertAssets: %v", err)
	}
	if err := handlers.db.(*Database).upsertLibrary(ctx, "lib1", "External", 1); err != nil {
		t.Fatalf("upsertLibrary: %v", err)
	}
	if err := handlers.db.(*Database).updateLibraryVisibility(ctx, "lib1", true); err != nil {
		t.Fatalf("updateLibraryVisibility: %v", err)
	}

	req := withTestUser(httptest.NewRequest("GET", "/assets/00000000-0000-0000-0000-000000000001/thumbnail", nil))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}
}

func TestHandleUpdateLocationHiddenLibraryAssetReturnsNotFound(t *testing.T) {
	immichWasCalled := false
	handlers, mux := newTestHandlersWithMockImmich(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "PUT" && r.URL.Path == "/api/assets" {
			immichWasCalled = true
			w.WriteHeader(http.StatusNoContent)
			return
		}
		http.NotFound(w, r)
	})

	ctx := context.Background()
	if err := handlers.db.(*Database).upsertAssets(ctx, testUserID, []AssetRow{{
		ImmichID:         "00000000-0000-0000-0000-000000000001",
		Type:             "IMAGE",
		OriginalFileName: "test.jpg",
		FileCreatedAt:    "2024-01-01T12:00:00Z",
		LibraryID:        ptr("lib1"),
	}}); err != nil {
		t.Fatalf("upsertAssets: %v", err)
	}
	if err := handlers.db.(*Database).upsertLibrary(ctx, "lib1", "External", 1); err != nil {
		t.Fatalf("upsertLibrary: %v", err)
	}
	if err := handlers.db.(*Database).updateLibraryVisibility(ctx, "lib1", true); err != nil {
		t.Fatalf("updateLibraryVisibility: %v", err)
	}

	req := withTestUser(httptest.NewRequest("PUT", "/assets/00000000-0000-0000-0000-000000000001/location",
		strings.NewReader(`{"latitude":48.85,"longitude":2.35}`)))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}
	if immichWasCalled {
		t.Fatal("expected hidden-library update to be blocked before Immich call")
	}
}

func TestHandleGetSuggestionsSuccess(t *testing.T) {
	handlers, mux := newTestHandlersWithMockImmich(t, func(w http.ResponseWriter, r *http.Request) {
		http.NotFound(w, r)
	})

	ctx := context.Background()
	d := handlers.db.(*Database)
	dateTime := "2024-06-15T12:00:00Z"
	d.upsertAssets(ctx, testUserID, []AssetRow{{
		ImmichID: "00000000-0000-0000-0000-000000000001", Type: "IMAGE",
		OriginalFileName: "test.jpg", FileCreatedAt: dateTime, DateTimeOriginal: &dateTime,
	}})

	req := withTestUser(httptest.NewRequest("GET", "/assets/00000000-0000-0000-0000-000000000001/suggestions", nil))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", rec.Code, rec.Body.String())
	}

	var resp SuggestionsResponse
	json.NewDecoder(rec.Body).Decode(&resp)
	if resp.SameDayClusters == nil {
		t.Error("expected non-nil sameDayClusters")
	}
}

func TestHandleGetAssetPageInfoSuccess(t *testing.T) {
	handlers, mux := newTestHandlersWithMockImmich(t, func(w http.ResponseWriter, r *http.Request) {
		http.NotFound(w, r)
	})

	d := handlers.db.(*Database)
	seedAsset(t, d, "00000000-0000-0000-0000-000000000001", ptr(48.85), ptr(2.35), "2024-01-01T12:00:00Z")
	seedAsset(t, d, "00000000-0000-0000-0000-000000000002", ptr(40.71), ptr(-74.0), "2024-01-02T12:00:00Z")

	req := withTestUser(httptest.NewRequest("GET", "/assets/00000000-0000-0000-0000-000000000001/page-info?pageSize=20", nil))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", rec.Code, rec.Body.String())
	}

	var info AssetPageInfo
	json.NewDecoder(rec.Body).Decode(&info)
	if info.Page < 1 {
		t.Errorf("expected page >= 1, got %d", info.Page)
	}
}

func TestHandleTriggerSyncSuccess(t *testing.T) {
	handlers, mux := newTestHandlersWithMockImmich(t, func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/api/search/metadata":
			json.NewEncoder(w).Encode(ImmichSearchResponse{
				Assets: struct {
					Items    []ImmichAssetResponse `json:"items"`
					NextPage *string               `json:"nextPage"`
				}{Items: []ImmichAssetResponse{}},
			})
		case r.URL.Path == "/api/stacks":
			json.NewEncoder(w).Encode([]ImmichStackResponse{})
		case r.URL.Path == "/api/albums":
			json.NewEncoder(w).Encode([]ImmichAlbumResponse{})
		default:
			http.NotFound(w, r)
		}
	})

	ctx := context.Background()
	handlers.db.(*Database).setSyncState(ctx, testUserID, "lastSyncAt", "2024-01-01T00:00:00Z")

	req := withTestUser(httptest.NewRequest("POST", "/sync", nil))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var resp map[string]string
	json.NewDecoder(rec.Body).Decode(&resp)
	if resp["status"] != "sync started" {
		t.Errorf("expected 'sync started', got '%s'", resp["status"])
	}

	handlers.syncService.wg.Wait()
}

func TestHandleGetPreviewBadUUID(t *testing.T) {
	_, mux := newTestHandlersWithMockImmich(t, func(w http.ResponseWriter, r *http.Request) {
		http.NotFound(w, r)
	})

	req := withTestUser(httptest.NewRequest("GET", "/assets/not-a-uuid/preview", nil))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rec.Code)
	}
}

func TestHandleGetAlbumsWithGPS(t *testing.T) {
	handlers, mux := newTestHandlersWithMockImmich(t, func(w http.ResponseWriter, r *http.Request) {
		http.NotFound(w, r)
	})

	ctx := context.Background()
	d := handlers.db.(*Database)
	seedAsset(t, d, "a1", ptr(48.85), ptr(2.35), "2024-01-01T12:00:00Z")
	seedAsset(t, d, "a2", ptr(40.71), ptr(-74.0), "2024-01-02T12:00:00Z")
	d.upsertAlbum(ctx, testUserID, "album1", "Vacation", nil, 2, "2024-01-02T00:00:00Z", nil)
	d.replaceAlbumAssets(ctx, testUserID, "album1", []string{"a1", "a2"})

	req := withTestUser(httptest.NewRequest("GET", "/albums?gpsFilter=with-gps", nil))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var albums []AlbumRow
	json.NewDecoder(rec.Body).Decode(&albums)
	if len(albums) != 1 {
		t.Errorf("expected 1 album, got %d", len(albums))
	}
}

func TestHandleGetSuggestionsNotFound(t *testing.T) {
	_, mux := newTestHandlersWithMockImmich(t, func(w http.ResponseWriter, r *http.Request) {
		http.NotFound(w, r)
	})

	req := withTestUser(httptest.NewRequest("GET", "/assets/00000000-0000-0000-0000-999999999999/suggestions", nil))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Errorf("expected 404 for nonexistent asset, got %d", rec.Code)
	}
}

func TestHiddenUpdateValidation(t *testing.T) {
	_, mux := newTestHandlers(t)

	tests := []struct {
		name   string
		body   string
		status int
	}{
		{"empty body returns 400", "", 400},
		{"invalid JSON returns 400", "{bad}", 400},
		{"unknown fields returns 400", `{"isHidden":true,"extra":true}`, 400},
		{"missing isHidden returns 400", `{}`, 400},
		{"null isHidden returns 400", `{"isHidden":null}`, 400},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := withTestUser(httptest.NewRequest("PUT", "/assets/00000000-0000-0000-0000-000000000001/hidden", strings.NewReader(tt.body)))
			req.Header.Set("Content-Type", "application/json")
			rec := httptest.NewRecorder()
			mux.ServeHTTP(rec, req)

			if rec.Code != tt.status {
				t.Errorf("expected %d, got %d (body: %s)", tt.status, rec.Code, rec.Body.String())
			}
		})
	}
}

func TestHandleUpdateHiddenSuccess(t *testing.T) {
	handlers, mux := newTestHandlers(t)
	d := handlers.db.(*Database)
	seedAsset(t, d, "00000000-0000-0000-0000-000000000001", ptr(48.85), ptr(2.35), "2024-01-01T12:00:00Z")

	req := withTestUser(httptest.NewRequest("PUT", "/assets/00000000-0000-0000-0000-000000000001/hidden",
		strings.NewReader(`{"isHidden":true}`)))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d (body: %s)", rec.Code, rec.Body.String())
	}

	ctx := context.Background()
	hidden, err := d.countFilteredAssets(ctx, testUserID, "", true, "hidden")
	if err != nil {
		t.Fatalf("countFilteredAssets: %v", err)
	}
	if hidden != 1 {
		t.Errorf("expected 1 hidden asset, got %d", hidden)
	}
}

func TestHandleUpdateHiddenNotFound(t *testing.T) {
	_, mux := newTestHandlers(t)

	req := withTestUser(httptest.NewRequest("PUT", "/assets/00000000-0000-0000-0000-000000000099/hidden",
		strings.NewReader(`{"isHidden":true}`)))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d (body: %s)", rec.Code, rec.Body.String())
	}
}

func TestHiddenFilterQueryParamValidation(t *testing.T) {
	_, mux := newTestHandlers(t)

	tests := []struct {
		name   string
		query  string
		status int
	}{
		{"default returns 200", "/assets?page=1&pageSize=10", 200},
		{"visible returns 200", "/assets?page=1&pageSize=10&hiddenFilter=visible", 200},
		{"hidden returns 200", "/assets?page=1&pageSize=10&hiddenFilter=hidden", 200},
		{"all returns 200", "/assets?page=1&pageSize=10&hiddenFilter=all", 200},
		{"invalid returns 400", "/assets?page=1&pageSize=10&hiddenFilter=garbage", 400},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := withTestUser(httptest.NewRequest("GET", tt.query, nil))
			rec := httptest.NewRecorder()
			mux.ServeHTTP(rec, req)

			if rec.Code != tt.status {
				t.Errorf("expected %d, got %d (body: %s)", tt.status, rec.Code, rec.Body.String())
			}
		})
	}
}

func TestHandleBulkUpdateHiddenSuccess(t *testing.T) {
	handlers, mux := newTestHandlers(t)
	d := handlers.db.(*Database)
	seedAsset(t, d, "00000000-0000-0000-0000-000000000001", ptr(48.85), ptr(2.35), "2024-01-01T12:00:00Z")
	seedAsset(t, d, "00000000-0000-0000-0000-000000000002", ptr(40.71), ptr(-74.0), "2024-01-02T12:00:00Z")
	seedAsset(t, d, "00000000-0000-0000-0000-000000000003", ptr(35.68), ptr(139.69), "2024-01-03T12:00:00Z")

	req := withTestUser(httptest.NewRequest("PUT", "/assets/bulk-hidden",
		strings.NewReader(`{"assetIDs":["00000000-0000-0000-0000-000000000001","00000000-0000-0000-0000-000000000002"],"isHidden":true}`)))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d (body: %s)", rec.Code, rec.Body.String())
	}

	ctx := context.Background()
	hidden, err := d.countFilteredAssets(ctx, testUserID, "", true, "hidden")
	if err != nil {
		t.Fatalf("countFilteredAssets: %v", err)
	}
	if hidden != 2 {
		t.Errorf("expected 2 hidden assets, got %d", hidden)
	}
}

func TestHandleBulkUpdateHiddenEmptyArray(t *testing.T) {
	_, mux := newTestHandlers(t)

	req := withTestUser(httptest.NewRequest("PUT", "/assets/bulk-hidden",
		strings.NewReader(`{"assetIDs":[],"isHidden":true}`)))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for empty array, got %d (body: %s)", rec.Code, rec.Body.String())
	}
}

func TestHandleBulkUpdateHiddenMissingIsHidden(t *testing.T) {
	_, mux := newTestHandlers(t)

	req := withTestUser(httptest.NewRequest("PUT", "/assets/bulk-hidden",
		strings.NewReader(`{"assetIDs":["00000000-0000-0000-0000-000000000001"]}`)))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for missing isHidden, got %d (body: %s)", rec.Code, rec.Body.String())
	}
}

func TestHandleBulkUpdateHiddenInvalidUUID(t *testing.T) {
	_, mux := newTestHandlers(t)

	req := withTestUser(httptest.NewRequest("PUT", "/assets/bulk-hidden",
		strings.NewReader(`{"assetIDs":["not-a-uuid"],"isHidden":true}`)))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for invalid UUID, got %d (body: %s)", rec.Code, rec.Body.String())
	}
}

func TestAlbumsEndpointReturnsEmptyList(t *testing.T) {
	_, mux := newTestHandlers(t)

	req := withTestUser(httptest.NewRequest("GET", "/albums", nil))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var albums []AlbumRow
	json.NewDecoder(rec.Body).Decode(&albums)
	if len(albums) != 0 {
		t.Errorf("expected 0 albums, got %d", len(albums))
	}
}
