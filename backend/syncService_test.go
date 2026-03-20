package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func newMockImmichFactory(t *testing.T, handler http.HandlerFunc) (*ImmichClientFactory, *ImmichClient) {
	t.Helper()
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)
	factory := &ImmichClientFactory{
		baseURL:    server.URL,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
	return factory, factory.forUser("test-key")
}

func newMockImmichFactoryNoRetry(t *testing.T, handler http.HandlerFunc) (*ImmichClientFactory, *ImmichClient) {
	t.Helper()
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)
	factory := &ImmichClientFactory{
		baseURL:    server.URL,
		httpClient: &http.Client{Timeout: 5 * time.Second},
	}
	return factory, factory.forUser("test-key")
}

func newMockNominatimServer(t *testing.T) *NominatimClient {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"display_name": "Paris, France",
			"address": map[string]string{
				"city":    "Paris",
				"state":   "Ile-de-France",
				"country": "France",
			},
		})
	}))
	t.Cleanup(server.Close)
	client := newNominatimClient(10 * time.Second)
	client.httpClient = server.Client()
	client.httpClient.Transport = &rewriteTransport{
		base: server.Client().Transport,
		url:  server.URL,
	}
	return client
}

type rewriteTransport struct {
	base http.RoundTripper
	url  string
}

func (t *rewriteTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	req = req.Clone(req.Context())
	req.URL.Scheme = "http"
	req.URL.Host = t.url[len("http://"):]
	return t.base.RoundTrip(req)
}

func TestSyncAssetsPagination(t *testing.T) {
	var requestCount atomic.Int32
	ctx := context.Background()

	factory, immich := newMockImmichFactory(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/search/metadata" {
			http.NotFound(w, r)
			return
		}

		var payload map[string]interface{}
		json.NewDecoder(r.Body).Decode(&payload)
		page := int(payload["page"].(float64))

		requestCount.Add(1)

		var items []ImmichAssetResponse
		if page == 1 {
			items = []ImmichAssetResponse{
				{ID: "a1", Type: "IMAGE", OriginalFileName: "a1.jpg", FileCreatedAt: "2024-01-01T00:00:00Z"},
				{ID: "a2", Type: "IMAGE", OriginalFileName: "a2.jpg", FileCreatedAt: "2024-01-02T00:00:00Z"},
			}
		}

		nextPage := "2"
		var nextPagePtr *string
		if page == 1 {
			nextPagePtr = &nextPage
		}

		json.NewEncoder(w).Encode(ImmichSearchResponse{
			Assets: struct {
				Items    []ImmichAssetResponse `json:"items"`
				NextPage *string               `json:"nextPage"`
			}{
				Items:    items,
				NextPage: nextPagePtr,
			},
		})
	})

	db := newTestDB(t)
	nom := newNominatimClient(10 * time.Second)
	svc := newSyncService(db, factory, nom)

	_, count, err := svc.syncAssets(ctx, testUserID, immich, nil, "test")
	if err != nil {
		t.Fatalf("syncAssets: %v", err)
	}
	if count != 2 {
		t.Errorf("expected 2 upserted, got %d", count)
	}

	if requestCount.Load() != 2 {
		t.Errorf("expected 2 API pages requested, got %d", requestCount.Load())
	}

	total, _ := db.countAssets(ctx, testUserID)
	if total != 2 {
		t.Errorf("expected 2 assets in DB, got %d", total)
	}
}

func TestSyncAssetsNonNumericNextPage(t *testing.T) {
	factory, immich := newMockImmichFactory(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/search/metadata" {
			http.NotFound(w, r)
			return
		}

		token := "abc-not-a-number"
		json.NewEncoder(w).Encode(ImmichSearchResponse{
			Assets: struct {
				Items    []ImmichAssetResponse `json:"items"`
				NextPage *string               `json:"nextPage"`
			}{
				Items: []ImmichAssetResponse{
					{ID: "a1", Type: "IMAGE", OriginalFileName: "a1.jpg", FileCreatedAt: "2024-01-01T00:00:00Z"},
				},
				NextPage: &token,
			},
		})
	})

	db := newTestDB(t)
	svc := newSyncService(db, factory, newNominatimClient(10 * time.Second))

	_, _, err := svc.syncAssets(context.Background(), testUserID, immich, nil, "test")
	if err == nil {
		t.Error("expected error on non-numeric nextPage")
	}
}

func TestSyncAssetsAPIError(t *testing.T) {
	factory, immich := newMockImmichFactoryNoRetry(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte(`{"error":"server error"}`))
	})

	db := newTestDB(t)
	svc := newSyncService(db, factory, newNominatimClient(10 * time.Second))

	_, _, err := svc.syncAssets(context.Background(), testUserID, immich, nil, "test")
	if err == nil {
		t.Error("expected error on API error")
	}
}

func TestSyncAlbumsErrorPropagation(t *testing.T) {
	factory, immich := newMockImmichFactoryNoRetry(t, func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/albums":
			json.NewEncoder(w).Encode([]ImmichAlbumResponse{
				{ID: "album1", AlbumName: "Test", AssetCount: 1, UpdatedAt: "2024-01-02T00:00:00Z"},
			})
		case "/api/albums/album1":
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`{"error":"fail"}`))
		default:
			http.NotFound(w, r)
		}
	})

	db := newTestDB(t)
	svc := newSyncService(db, factory, newNominatimClient(10 * time.Second))

	svc.syncAlbums(context.Background(), testUserID, immich, false)

	var count int
	db.db.QueryRow("SELECT COUNT(*) FROM albumAssets WHERE albumID = ?", "album1").Scan(&count)
	if count != 0 {
		t.Errorf("expected 0 album assets after error, got %d", count)
	}
}

func TestSyncStacksUpdatesDB(t *testing.T) {
	ctx := context.Background()

	factory, immich := newMockImmichFactory(t, func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/api/search/metadata":
			json.NewEncoder(w).Encode(ImmichSearchResponse{
				Assets: struct {
					Items    []ImmichAssetResponse `json:"items"`
					NextPage *string               `json:"nextPage"`
				}{
					Items: []ImmichAssetResponse{
						{ID: "s1", Type: "IMAGE", OriginalFileName: "s1.jpg", FileCreatedAt: "2024-01-01T00:00:00Z"},
						{ID: "s2", Type: "IMAGE", OriginalFileName: "s2.jpg", FileCreatedAt: "2024-01-02T00:00:00Z"},
					},
				},
			})
		case r.URL.Path == "/api/stacks":
			json.NewEncoder(w).Encode([]ImmichStackResponse{
				{
					ID:             "stack1",
					PrimaryAssetID: "s1",
					Assets: []struct {
						ID string `json:"id"`
					}{
						{ID: "s1"},
						{ID: "s2"},
					},
				},
			})
		default:
			http.NotFound(w, r)
		}
	})

	db := newTestDB(t)
	svc := newSyncService(db, factory, newNominatimClient(10 * time.Second))

	if _, _, err := svc.syncAssets(ctx, testUserID, immich, nil, "test"); err != nil {
		t.Fatalf("syncAssets: %v", err)
	}
	svc.syncStacks(ctx, testUserID, immich)

	asset, err := db.getAssetByID(ctx, testUserID, "s2")
	if err != nil {
		t.Fatalf("getAssetByID: %v", err)
	}
	if asset == nil {
		t.Fatal("expected asset s2 to exist")
	}
	if asset.StackID == nil || *asset.StackID != "stack1" {
		t.Errorf("expected stackID 'stack1', got %v", asset.StackID)
	}
	if asset.StackPrimaryAssetID == nil || *asset.StackPrimaryAssetID != "s1" {
		t.Errorf("expected stackPrimaryAssetID 's1', got %v", asset.StackPrimaryAssetID)
	}
}

func TestNominatimRetryAfterSeconds(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Retry-After", "5")
		w.WriteHeader(http.StatusTooManyRequests)
	}))
	t.Cleanup(server.Close)

	client := newNominatimClient(10 * time.Second)
	client.httpClient = server.Client()
	client.httpClient.Transport = &rewriteTransport{
		base: server.Client().Transport,
		url:  server.URL,
	}

	originalLimit := client.limiter.Limit()

	ctx := context.Background()
	result, err := client.ReverseGeocode(ctx, 48.85, 2.35)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result != "48.8500, 2.3500" {
		t.Errorf("expected fallback coords, got %s", result)
	}

	newLimit := client.limiter.Limit()
	if newLimit == originalLimit {
		t.Error("expected limiter rate to change after Retry-After")
	}
}

func TestNominatimRetryAfterHTTPDate(t *testing.T) {
	futureTime := time.Now().Add(10 * time.Second)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Retry-After", futureTime.UTC().Format(http.TimeFormat))
		w.WriteHeader(http.StatusTooManyRequests)
	}))
	t.Cleanup(server.Close)

	client := newNominatimClient(10 * time.Second)
	client.httpClient = server.Client()
	client.httpClient.Transport = &rewriteTransport{
		base: server.Client().Transport,
		url:  server.URL,
	}

	originalLimit := client.limiter.Limit()

	ctx := context.Background()
	result, err := client.ReverseGeocode(ctx, 48.85, 2.35)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result != "48.8500, 2.3500" {
		t.Errorf("expected fallback coords, got %s", result)
	}

	newLimit := client.limiter.Limit()
	if newLimit == originalLimit {
		t.Error("expected limiter rate to change after Retry-After HTTP-date")
	}
}

func newFullMockImmichFactory(t *testing.T) (*ImmichClientFactory, *ImmichClient) {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/api/search/metadata":
			json.NewEncoder(w).Encode(ImmichSearchResponse{
				Assets: struct {
					Items    []ImmichAssetResponse `json:"items"`
					NextPage *string               `json:"nextPage"`
				}{Items: []ImmichAssetResponse{
					{ID: "a1", Type: "IMAGE", OriginalFileName: "a1.jpg", FileCreatedAt: "2024-01-01T00:00:00Z",
						ExifInfo: &ImmichExifInfo{Latitude: ptr(48.85), Longitude: ptr(2.35), City: ptr("Paris"), Country: ptr("France")}},
				}},
			})
		case r.URL.Path == "/api/stacks":
			json.NewEncoder(w).Encode([]ImmichStackResponse{})
		case r.URL.Path == "/api/albums" && r.Method == "GET":
			json.NewEncoder(w).Encode([]ImmichAlbumResponse{})
		case r.URL.Path == "/api/libraries" && r.Method == "GET":
			json.NewEncoder(w).Encode([]ImmichLibraryResponse{})
		case r.Method == "PUT" && r.URL.Path == "/api/assets":
			w.WriteHeader(http.StatusNoContent)
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(server.Close)
	factory := &ImmichClientFactory{
		baseURL:    server.URL,
		httpClient: &http.Client{Timeout: 5 * time.Second},
	}
	return factory, factory.forUser("test-key")
}

func TestDoFullSync(t *testing.T) {
	ctx := context.Background()
	db := newTestDB(t)
	factory, immich := newFullMockImmichFactory(t)
	nom := newMockNominatimServer(t)
	svc := newSyncService(db, factory, nom)

	svc.doUserFullSync(ctx, testUserID, immich)

	total, _ := db.countAssets(ctx, testUserID)
	if total != 1 {
		t.Errorf("expected 1 asset after full sync, got %d", total)
	}

	lastSync, _ := db.getSyncState(ctx, testUserID, "lastSyncAt")
	if lastSync == nil {
		t.Error("expected lastSyncAt to be set")
	}
	lastFullSync, _ := db.getSyncState(ctx, testUserID, "lastFullSyncAt")
	if lastFullSync == nil {
		t.Error("expected lastFullSyncAt to be set")
	}
	backfillDone, _ := db.getSyncState(ctx, testUserID, "libraryIDBackfillDone")
	if backfillDone == nil || *backfillDone != "true" {
		t.Errorf("expected libraryIDBackfillDone=true, got %v", backfillDone)
	}
}

func TestDoFullSyncDoesNotMarkBackfillDoneWhenLibrarySyncFails(t *testing.T) {
	ctx := context.Background()
	db := newTestDB(t)
	factory, immich := newMockImmichFactoryNoRetry(t, func(w http.ResponseWriter, r *http.Request) {
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
		case r.URL.Path == "/api/libraries":
			w.WriteHeader(http.StatusForbidden)
		case r.URL.Path == "/api/albums":
			json.NewEncoder(w).Encode([]ImmichAlbumResponse{})
		default:
			http.NotFound(w, r)
		}
	})
	nom := newMockNominatimServer(t)
	svc := newSyncService(db, factory, nom)

	svc.doUserFullSync(ctx, testUserID, immich)

	backfillDone, _ := db.getSyncState(ctx, testUserID, "libraryIDBackfillDone")
	if backfillDone != nil {
		t.Errorf("expected libraryIDBackfillDone to remain unset when library sync fails, got %v", backfillDone)
	}
}

func TestDoIncrementalSyncFallsBackToFull(t *testing.T) {
	ctx := context.Background()
	db := newTestDB(t)
	factory, immich := newFullMockImmichFactory(t)
	nom := newMockNominatimServer(t)
	svc := newSyncService(db, factory, nom)

	svc.doUserIncrementalSync(ctx, testUserID, immich)

	lastFullSync, _ := db.getSyncState(ctx, testUserID, "lastFullSyncAt")
	if lastFullSync == nil {
		t.Error("expected full sync fallback when no lastSyncAt exists")
	}
}

func TestDoIncrementalSync(t *testing.T) {
	ctx := context.Background()
	db := newTestDB(t)
	factory, immich := newFullMockImmichFactory(t)
	nom := newMockNominatimServer(t)
	svc := newSyncService(db, factory, nom)

	db.setSyncState(ctx, testUserID, "lastSyncAt", "2024-01-01T00:00:00Z")

	svc.doUserIncrementalSync(ctx, testUserID, immich)

	total, _ := db.countAssets(ctx, testUserID)
	if total != 1 {
		t.Errorf("expected 1 asset after incremental sync, got %d", total)
	}
}

func TestDoIncrementalSyncForcesFullWhenBackfillNeeded(t *testing.T) {
	ctx := context.Background()
	db := newTestDB(t)
	factory, immich := newFullMockImmichFactory(t)
	nom := newMockNominatimServer(t)
	svc := newSyncService(db, factory, nom)

	db.setSyncState(ctx, testUserID, "lastSyncAt", "2024-01-01T00:00:00Z")
	db.setSyncState(ctx, testUserID, "hasLibraryAccess", "true")
	db.upsertLibrary(ctx,"lib1", "External", 10)
	seedAsset(t, db, "a-existing", ptr(48.85), ptr(2.35), "2024-01-01T12:00:00Z")

	svc.doUserIncrementalSync(ctx, testUserID, immich)

	lastFullSync, _ := db.getSyncState(ctx, testUserID, "lastFullSyncAt")
	if lastFullSync == nil {
		t.Error("expected full sync when libraryID backfill is needed")
	}
}

func TestStartFullSyncSkipsIfAlreadySyncing(t *testing.T) {
	ctx := context.Background()
	db := newTestDB(t)
	factory, immich := newFullMockImmichFactory(t)
	svc := newSyncService(db, factory, newNominatimClient(10 * time.Second))

	svc.mu.Lock()
	svc.userSyncing[testUserID] = true
	svc.mu.Unlock()

	svc.startUserFullSync(ctx, testUserID, immich)

	total, _ := db.countAssets(ctx, testUserID)
	if total != 0 {
		t.Errorf("expected 0 assets (sync should have been skipped), got %d", total)
	}
}

func TestRecordAndClearSyncError(t *testing.T) {
	ctx := context.Background()
	db := newTestDB(t)
	factory, _ := newFullMockImmichFactory(t)
	svc := newSyncService(db, factory, newNominatimClient(10 * time.Second))

	svc.recordSyncError(ctx, testUserID, "test error")
	val, _ := db.getSyncState(ctx, testUserID, "lastSyncError")
	if val == nil || *val != "test error" {
		t.Errorf("expected 'test error', got %v", val)
	}

	svc.clearSyncError(ctx, testUserID)
	val, _ = db.getSyncState(ctx, testUserID, "lastSyncError")
	if val != nil {
		t.Errorf("expected nil after clear, got %v", *val)
	}
}

func TestTryStartAndReleaseSyncLock(t *testing.T) {
	factory, _ := newFullMockImmichFactory(t)
	svc := newSyncService(newTestDB(t), factory, newNominatimClient(10 * time.Second))

	if _, ok := svc.tryStartUserSync(testUserID, func() {}); !ok {
		t.Error("expected first start to succeed")
	}
	if _, ok := svc.tryStartUserSync(testUserID, func() {}); ok {
		t.Error("expected second start to fail")
	}

	svc.releaseUserSyncLock(testUserID)
	svc.clearUserCancel(testUserID)
	if _, ok := svc.tryStartUserSync(testUserID, func() {}); !ok {
		t.Error("expected start after release to succeed")
	}
}

func TestTryStartUserSyncStoresCancel(t *testing.T) {
	factory, _ := newFullMockImmichFactory(t)
	svc := newSyncService(newTestDB(t), factory, newNominatimClient(10 * time.Second))

	cancelWasCalled := false
	cancel := func() {
		cancelWasCalled = true
	}

	reason, ok := svc.tryStartUserSync(testUserID, cancel)
	if !ok {
		t.Fatalf("expected sync to start, got reason %q", reason)
	}

	svc.mu.Lock()
	storedCancel := svc.userCancels[testUserID]
	svc.mu.Unlock()

	if storedCancel == nil {
		t.Fatal("expected cancel function to be stored")
	}

	storedCancel()
	if !cancelWasCalled {
		t.Error("expected stored cancel function to execute")
	}
}

func TestCancelUserSyncTimesOut(t *testing.T) {
	factory, _ := newFullMockImmichFactory(t)
	svc := newSyncService(newTestDB(t), factory, newNominatimClient(10 * time.Second))
	svc.mu.Lock()
	svc.userSyncing[testUserID] = true
	svc.mu.Unlock()

	stopped := svc.cancelUserSyncWithTimeout(testUserID, 50*time.Millisecond)
	if stopped {
		t.Fatal("expected cancelUserSyncWithTimeout to return false when sync does not stop")
	}
}

func TestCancelUserSyncWaitsForSyncToStop(t *testing.T) {
	factory, _ := newFullMockImmichFactory(t)
	svc := newSyncService(newTestDB(t), factory, newNominatimClient(10 * time.Second))
	svc.mu.Lock()
	svc.userSyncing[testUserID] = true
	svc.userCancels[testUserID] = func() {
		go func() {
			time.Sleep(20 * time.Millisecond)
			svc.releaseUserSyncLock(testUserID)
			svc.clearUserCancel(testUserID)
		}()
	}
	svc.mu.Unlock()

	stopped := svc.cancelUserSyncWithTimeout(testUserID, 500*time.Millisecond)
	if !stopped {
		t.Fatal("expected cancelUserSyncWithTimeout to return true after sync stops")
	}
}

func TestPauseUserSyncReservesLock(t *testing.T) {
	factory, _ := newFullMockImmichFactory(t)
	svc := newSyncService(newTestDB(t), factory, newNominatimClient(10 * time.Second))

	if err := svc.pauseUserSync(context.Background(), testUserID); err != nil {
		t.Fatalf("pauseUserSync: %v", err)
	}
	defer svc.releaseUserSyncLock(testUserID)

	if svc.acquireUserSyncLock(testUserID) {
		t.Fatal("expected reserved lock to block additional sync starts")
	}
}

func TestPauseUserSyncHonorsContextDeadline(t *testing.T) {
	factory, _ := newFullMockImmichFactory(t)
	svc := newSyncService(newTestDB(t), factory, newNominatimClient(10 * time.Second))

	if !svc.acquireUserSyncLock(testUserID) {
		t.Fatal("expected setup lock acquisition")
	}
	defer svc.releaseUserSyncLock(testUserID)

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()

	if err := svc.pauseUserSync(ctx, testUserID); err == nil {
		t.Fatal("expected pauseUserSync to fail when lock is already reserved")
	}
}

func TestRunStartupSyncsStartsUsersConcurrently(t *testing.T) {
	ctx := context.Background()
	db := newTestDB(t)

	firstUserID := "startup-user-1"
	secondUserID := "startup-user-2"
	firstKey := "startup-key-1"
	secondKey := "startup-key-2"

	if err := db.createUser(ctx, firstUserID, "startup1@example.com", "hashed"); err != nil {
		t.Fatalf("create first startup user: %v", err)
	}
	if err := db.createUser(ctx, secondUserID, "startup2@example.com", "hashed"); err != nil {
		t.Fatalf("create second startup user: %v", err)
	}
	if err := db.updateImmichAPIKey(ctx, firstUserID, &firstKey); err != nil {
		t.Fatalf("set first API key: %v", err)
	}
	if err := db.updateImmichAPIKey(ctx, secondUserID, &secondKey); err != nil {
		t.Fatalf("set second API key: %v", err)
	}
	if err := db.setSyncState(ctx, firstUserID, "lastSyncAt", "2024-01-01T00:00:00Z"); err != nil {
		t.Fatalf("set first lastSyncAt: %v", err)
	}
	if err := db.setSyncState(ctx, secondUserID, "lastSyncAt", "2024-01-01T00:00:00Z"); err != nil {
		t.Fatalf("set second lastSyncAt: %v", err)
	}

	firstStarted := make(chan struct{}, 1)
	secondStarted := make(chan struct{}, 1)
	releaseFirst := make(chan struct{})

	factory, _ := newMockImmichFactory(t, func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/api/search/metadata":
			apiKey := r.Header.Get("x-api-key")
			if apiKey == firstKey {
				select {
				case firstStarted <- struct{}{}:
				default:
				}
				<-releaseFirst
			}
			if apiKey == secondKey {
				select {
				case secondStarted <- struct{}{}:
				default:
				}
			}
			json.NewEncoder(w).Encode(ImmichSearchResponse{
				Assets: struct {
					Items    []ImmichAssetResponse `json:"items"`
					NextPage *string               `json:"nextPage"`
				}{
					Items:    []ImmichAssetResponse{},
					NextPage: nil,
				},
			})
		case r.URL.Path == "/api/stacks":
			json.NewEncoder(w).Encode([]ImmichStackResponse{})
		case r.URL.Path == "/api/albums":
			json.NewEncoder(w).Encode([]ImmichAlbumResponse{})
		case r.URL.Path == "/api/libraries":
			json.NewEncoder(w).Encode([]ImmichLibraryResponse{})
		default:
			http.NotFound(w, r)
		}
	})

	svc := newSyncService(db, factory, newNominatimClient(10 * time.Second))
	users := []UserRow{
		{ID: firstUserID, ImmichAPIKey: &firstKey},
		{ID: secondUserID, ImmichAPIKey: &secondKey},
	}

	svc.runStartupSyncs(ctx, users)

	select {
	case <-firstStarted:
	case <-time.After(2 * time.Second):
		t.Fatal("first startup sync did not start")
	}

	select {
	case <-secondStarted:
	case <-time.After(2 * time.Second):
		t.Fatal("second startup sync did not start while first was blocked")
	}

	close(releaseFirst)
	svc.wg.Wait()
}

func TestRecomputeFrequentLocations(t *testing.T) {
	ctx := context.Background()
	db := newTestDB(t)
	nom := newMockNominatimServer(t)
	factory, _ := newFullMockImmichFactory(t)
	svc := newSyncService(db, factory, nom)

	seedAsset(t, db, "a1", ptr(48.85), ptr(2.35), "2024-01-01T12:00:00Z")
	seedAsset(t, db, "a2", ptr(48.86), ptr(2.36), "2024-01-02T12:00:00Z")

	svc.recomputeFrequentLocations(ctx, testUserID)
	svc.wg.Wait()

	locs, err := db.getFrequentLocations(ctx, testUserID, 10)
	if err != nil {
		t.Fatalf("getFrequentLocations: %v", err)
	}
	if len(locs) == 0 {
		t.Error("expected at least 1 frequent location")
	}
}

func TestEnrichFrequentLocationLabels(t *testing.T) {
	ctx := context.Background()
	db := newTestDB(t)
	nom := newMockNominatimServer(t)
	factory, _ := newFullMockImmichFactory(t)
	svc := newSyncService(db, factory, nom)

	clusters := []FrequentLocationRow{
		{Latitude: 48.85, Longitude: 2.35, Label: "48.8500, 2.3500", AssetCount: 10},
	}
	db.replaceFrequentLocations(ctx, testUserID, clusters)

	gen := svc.freqLocGeneration.Add(1)
	svc.enrichFrequentLocationLabels(ctx, testUserID, clusters, gen)

	locs, _ := db.getFrequentLocations(ctx, testUserID, 10)
	if len(locs) == 0 {
		t.Fatal("expected locations after enrichment")
	}
	if locs[0].Label == "48.8500, 2.3500" {
		t.Error("expected label to be enriched, still has coord format")
	}
}

func TestEnrichSkipsStaleGeneration(t *testing.T) {
	ctx := context.Background()
	db := newTestDB(t)
	nom := newMockNominatimServer(t)
	factory, _ := newFullMockImmichFactory(t)
	svc := newSyncService(db, factory, nom)

	clusters := []FrequentLocationRow{
		{Latitude: 48.85, Longitude: 2.35, Label: "original", AssetCount: 10},
	}
	db.replaceFrequentLocations(ctx, testUserID, clusters)

	svc.freqLocGeneration.Store(5)
	svc.enrichFrequentLocationLabels(ctx, testUserID, clusters, 3)

	locs, _ := db.getFrequentLocations(ctx, testUserID, 10)
	if len(locs) > 0 && locs[0].Label != "original" {
		t.Errorf("expected stale enrichment to be skipped, label changed to %s", locs[0].Label)
	}
}

func TestStartPeriodicSync(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	db := newTestDB(t)
	factory, immich := newFullMockImmichFactory(t)
	svc := newSyncService(db, factory, newNominatimClient(10 * time.Second))

	db.createUser(ctx, testUserID, "test@example.com", "hashed")
	apiKey := "test-key"
	db.updateImmichAPIKey(ctx, testUserID, &apiKey)
	db.setSyncState(ctx, testUserID, "lastSyncAt", "2024-01-01T00:00:00Z")

	_ = immich
	svc.startPeriodicSync(ctx, 50)
	time.Sleep(120 * time.Millisecond)
	cancel()
	svc.wg.Wait()

	total, _ := db.countAssets(context.Background(), testUserID)
	if total == 0 {
		t.Error("expected periodic sync to have run at least once")
	}
}

func TestMapImmichToAssetRowWithExif(t *testing.T) {
	item := ImmichAssetResponse{
		ID:               "a1",
		Type:             "IMAGE",
		OriginalFileName: "photo.jpg",
		FileCreatedAt:    "2024-01-01T00:00:00Z",
		ExifInfo: &ImmichExifInfo{
			Latitude:         ptr(48.85),
			Longitude:        ptr(2.35),
			City:             ptr("Paris"),
			State:            ptr("Ile-de-France"),
			Country:          ptr("France"),
			DateTimeOriginal: ptr("2024-01-01T10:00:00Z"),
		},
	}

	row := mapImmichToAssetRow(item)
	if row.Latitude == nil || *row.Latitude != 48.85 {
		t.Errorf("expected latitude 48.85, got %v", row.Latitude)
	}
	if row.City == nil || *row.City != "Paris" {
		t.Errorf("expected city Paris, got %v", row.City)
	}
	if row.DateTimeOriginal == nil || *row.DateTimeOriginal != "2024-01-01T10:00:00Z" {
		t.Errorf("expected dateTimeOriginal, got %v", row.DateTimeOriginal)
	}
}

func TestMapImmichToAssetRowWithLibraryID(t *testing.T) {
	item := ImmichAssetResponse{
		ID:               "a1",
		Type:             "IMAGE",
		OriginalFileName: "photo.jpg",
		FileCreatedAt:    "2024-01-01T00:00:00Z",
		LibraryID:        ptr("lib-123"),
	}

	row := mapImmichToAssetRow(item)
	if row.LibraryID == nil || *row.LibraryID != "lib-123" {
		t.Errorf("expected libraryID 'lib-123', got %v", row.LibraryID)
	}
}

func TestSyncLibraries(t *testing.T) {
	ctx := context.Background()

	factory, immich := newMockImmichFactory(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/libraries" {
			json.NewEncoder(w).Encode([]ImmichLibraryResponse{
				{ID: "lib1", Name: "Photos", AssetCount: 100},
				{ID: "lib2", Name: "Archive", AssetCount: 50},
			})
			return
		}
		http.NotFound(w, r)
	})

	db := newTestDB(t)
	svc := newSyncService(db, factory, newNominatimClient(10 * time.Second))

	svc.syncLibraries(ctx, testUserID, immich)

	libs, err := db.getLibraries(ctx)
	if err != nil {
		t.Fatalf("getLibraries: %v", err)
	}
	if len(libs) != 2 {
		t.Fatalf("expected 2 libraries, got %d", len(libs))
	}
}

func TestSyncLibraries403Graceful(t *testing.T) {
	ctx := context.Background()

	factory, immich := newMockImmichFactoryNoRetry(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/libraries" {
			w.WriteHeader(http.StatusForbidden)
			return
		}
		http.NotFound(w, r)
	})

	db := newTestDB(t)
	svc := newSyncService(db, factory, newNominatimClient(10 * time.Second))

	err := svc.syncLibraries(ctx, testUserID, immich)
	if err == nil {
		t.Error("expected error on 403")
	}

	libs, _ := db.getLibraries(ctx)
	if len(libs) != 0 {
		t.Errorf("expected 0 libraries after 403, got %d", len(libs))
	}

	hasAccess, err := db.getSyncState(ctx, testUserID, "hasLibraryAccess")
	if err != nil {
		t.Fatalf("get hasLibraryAccess: %v", err)
	}
	if hasAccess == nil || *hasAccess != "false" {
		t.Fatalf("expected hasLibraryAccess=false after 403, got %v", hasAccess)
	}
}

func TestSyncLibraries500KeepsExistingAccessState(t *testing.T) {
	ctx := context.Background()

	factory, immich := newMockImmichFactoryNoRetry(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/libraries" {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		http.NotFound(w, r)
	})

	db := newTestDB(t)
	if err := db.setSyncState(ctx, testUserID, "hasLibraryAccess", "true"); err != nil {
		t.Fatalf("set hasLibraryAccess: %v", err)
	}
	svc := newSyncService(db, factory, newNominatimClient(10 * time.Second))

	err := svc.syncLibraries(ctx, testUserID, immich)
	if err == nil {
		t.Fatal("expected error on 500")
	}

	hasAccess, err := db.getSyncState(ctx, testUserID, "hasLibraryAccess")
	if err != nil {
		t.Fatalf("get hasLibraryAccess: %v", err)
	}
	if hasAccess == nil || *hasAccess != "true" {
		t.Fatalf("expected hasLibraryAccess to remain true after 500, got %v", hasAccess)
	}
}

func TestSyncLibrariesDeletesStale(t *testing.T) {
	ctx := context.Background()
	db := newTestDB(t)

	db.upsertLibrary(ctx,"old-lib", "Old Library", 10)

	factory, immich := newMockImmichFactory(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/libraries" {
			json.NewEncoder(w).Encode([]ImmichLibraryResponse{
				{ID: "new-lib", Name: "New Library", AssetCount: 20},
			})
			return
		}
		http.NotFound(w, r)
	})

	svc := newSyncService(db, factory, newNominatimClient(10 * time.Second))
	svc.syncLibraries(ctx, testUserID, immich)

	libs, _ := db.getLibraries(ctx)
	if len(libs) != 1 {
		t.Fatalf("expected 1 library, got %d", len(libs))
	}
	if libs[0].LibraryID != "new-lib" {
		t.Errorf("expected 'new-lib', got %s", libs[0].LibraryID)
	}
}

func TestSyncAlbumsSuccess(t *testing.T) {
	ctx := context.Background()

	factory, immich := newMockImmichFactory(t, func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/api/albums" && r.Method == "GET":
			json.NewEncoder(w).Encode([]ImmichAlbumResponse{
				{ID: "album1", AlbumName: "Vacation", AssetCount: 2, UpdatedAt: "2024-01-02T00:00:00Z"},
			})
		case r.URL.Path == "/api/albums/album1":
			json.NewEncoder(w).Encode(ImmichAlbumDetailResponse{
				Assets: []struct {
					ID string `json:"id"`
				}{{ID: "a1"}, {ID: "a2"}},
			})
		default:
			http.NotFound(w, r)
		}
	})

	db := newTestDB(t)
	seedAsset(t, db, "a1", ptr(48.85), ptr(2.35), "2024-01-01T12:00:00Z")
	seedAsset(t, db, "a2", ptr(40.71), ptr(-74.0), "2024-01-02T12:00:00Z")

	svc := newSyncService(db, factory, newNominatimClient(10 * time.Second))
	err := svc.syncAlbums(ctx, testUserID, immich, false)
	if err != nil {
		t.Fatalf("syncAlbums: %v", err)
	}

	m, _ := db.getAlbumUpdatedAtMap(ctx, testUserID)
	if len(m) != 1 {
		t.Errorf("expected 1 album, got %d", len(m))
	}

	var count int
	db.db.QueryRow("SELECT COUNT(*) FROM albumAssets WHERE albumID = ?", "album1").Scan(&count)
	if count != 2 {
		t.Errorf("expected 2 album assets, got %d", count)
	}
}

func TestDoFullSyncWithAlbumError(t *testing.T) {
	ctx := context.Background()

	factory, immich := newMockImmichFactoryNoRetry(t, func(w http.ResponseWriter, r *http.Request) {
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
			w.WriteHeader(http.StatusInternalServerError)
		default:
			http.NotFound(w, r)
		}
	})

	db := newTestDB(t)
	svc := newSyncService(db, factory, newNominatimClient(10 * time.Second))
	svc.doUserFullSync(ctx, testUserID, immich)

	errState, _ := db.getSyncState(ctx, testUserID, "lastSyncError")
	if errState == nil {
		t.Error("expected sync error to be recorded after album failure")
	}
}

func TestImmichBulkUpdateLocation(t *testing.T) {
	_, immich := newMockImmichFactory(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "PUT" && r.URL.Path == "/api/assets" {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		http.NotFound(w, r)
	})

	err := immich.bulkUpdateLocation(context.Background(), []string{"a1", "a2"}, 48.85, 2.35)
	if err != nil {
		t.Fatalf("bulkUpdateLocation: %v", err)
	}
}

func TestImmichBulkUpdateLocationError(t *testing.T) {
	_, immich := newMockImmichFactoryNoRetry(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	})

	err := immich.bulkUpdateLocation(context.Background(), []string{"a1"}, 48.85, 2.35)
	if err == nil {
		t.Error("expected error on 500 response")
	}
}

func TestImmichGetThumbnail(t *testing.T) {
	_, immich := newMockImmichFactory(t, func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "/thumbnail") {
			w.Header().Set("Content-Type", "image/jpeg")
			w.Write([]byte("img"))
			return
		}
		http.NotFound(w, r)
	})

	resp, err := immich.getThumbnail(context.Background(), "a1")
	if err != nil {
		t.Fatalf("getThumbnail: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
}

func TestImmichGetPreview(t *testing.T) {
	_, immich := newMockImmichFactory(t, func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "/thumbnail") {
			w.Header().Set("Content-Type", "image/webp")
			w.Write([]byte("preview"))
			return
		}
		http.NotFound(w, r)
	})

	resp, err := immich.getPreview(context.Background(), "a1")
	if err != nil {
		t.Fatalf("getPreview: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
}

func TestMapImmichToAssetRowWithoutExif(t *testing.T) {
	item := ImmichAssetResponse{
		ID:               "a1",
		Type:             "IMAGE",
		OriginalFileName: "photo.jpg",
		FileCreatedAt:    "2024-01-01T00:00:00Z",
	}

	row := mapImmichToAssetRow(item)
	if row.Latitude != nil {
		t.Errorf("expected nil latitude, got %v", row.Latitude)
	}
	if row.City != nil {
		t.Errorf("expected nil city, got %v", row.City)
	}
}

func TestImmichGetStacks(t *testing.T) {
	_, immich := newMockImmichFactory(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/stacks" {
			json.NewEncoder(w).Encode([]ImmichStackResponse{
				{ID: "s1", PrimaryAssetID: "a1", Assets: []struct {
					ID string `json:"id"`
				}{{ID: "a1"}, {ID: "a2"}}},
			})
			return
		}
		http.NotFound(w, r)
	})

	stacks, err := immich.getStacks(context.Background())
	if err != nil {
		t.Fatalf("getStacks: %v", err)
	}
	if len(stacks) != 1 {
		t.Errorf("expected 1 stack, got %d", len(stacks))
	}
	if len(stacks[0].Assets) != 2 {
		t.Errorf("expected 2 assets in stack, got %d", len(stacks[0].Assets))
	}
}

func TestImmichGetStacksError(t *testing.T) {
	_, immich := newMockImmichFactoryNoRetry(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	})

	_, err := immich.getStacks(context.Background())
	if err == nil {
		t.Error("expected error on 500 response")
	}
}

func TestImmichGetAlbums(t *testing.T) {
	_, immich := newMockImmichFactory(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/albums" {
			json.NewEncoder(w).Encode([]ImmichAlbumResponse{
				{ID: "album1", AlbumName: "Vacation", AssetCount: 5, UpdatedAt: "2024-01-01T00:00:00Z"},
			})
			return
		}
		http.NotFound(w, r)
	})

	albums, err := immich.getAlbums(context.Background())
	if err != nil {
		t.Fatalf("getAlbums: %v", err)
	}
	if len(albums) != 1 {
		t.Errorf("expected 1 album, got %d", len(albums))
	}
}

func TestImmichGetAlbumAssetIDs(t *testing.T) {
	_, immich := newMockImmichFactory(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/albums/album1" {
			json.NewEncoder(w).Encode(ImmichAlbumDetailResponse{
				Assets: []struct {
					ID string `json:"id"`
				}{{ID: "a1"}, {ID: "a2"}, {ID: "a3"}},
			})
			return
		}
		http.NotFound(w, r)
	})

	ids, err := immich.getAlbumAssetIDs(context.Background(), "album1")
	if err != nil {
		t.Fatalf("getAlbumAssetIDs: %v", err)
	}
	if len(ids) != 3 {
		t.Errorf("expected 3 asset IDs, got %d", len(ids))
	}
}

func TestSyncStacksWithStacks(t *testing.T) {
	ctx := context.Background()

	factory, immich := newMockImmichFactory(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/stacks" {
			json.NewEncoder(w).Encode([]ImmichStackResponse{
				{ID: "s1", PrimaryAssetID: "a1", Assets: []struct {
					ID string `json:"id"`
				}{{ID: "a1"}, {ID: "a2"}}},
			})
			return
		}
		http.NotFound(w, r)
	})

	db := newTestDB(t)
	seedAsset(t, db, "a1", ptr(48.85), ptr(2.35), "2024-01-01T12:00:00Z")
	seedAsset(t, db, "a2", ptr(48.86), ptr(2.36), "2024-01-02T12:00:00Z")

	svc := newSyncService(db, factory, newNominatimClient(10 * time.Second))
	svc.syncStacks(ctx, testUserID, immich)

	stackID, _ := db.getAssetStackID(ctx, testUserID, "a2")
	if stackID == nil {
		t.Error("expected a2 to have a stackID after sync")
	}
}

func TestStartFullSync(t *testing.T) {
	ctx := context.Background()

	factory, immich := newMockImmichFactory(t, func(w http.ResponseWriter, r *http.Request) {
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

	db := newTestDB(t)
	svc := newSyncService(db, factory, newNominatimClient(10 * time.Second))
	svc.startUserFullSync(ctx, testUserID, immich)

	lastSync, _ := db.getSyncState(ctx, testUserID, "lastSyncAt")
	if lastSync == nil {
		t.Error("expected lastSyncAt to be set after full sync")
	}
}

func TestStartIncrementalSync(t *testing.T) {
	ctx := context.Background()

	factory, immich := newMockImmichFactory(t, func(w http.ResponseWriter, r *http.Request) {
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

	db := newTestDB(t)
	db.setSyncState(ctx, testUserID, "lastSyncAt", "2024-01-01T00:00:00Z")
	svc := newSyncService(db, factory, newNominatimClient(10 * time.Second))
	svc.startUserIncrementalSync(ctx, testUserID, immich)

	lastSync, _ := db.getSyncState(ctx, testUserID, "lastSyncAt")
	if lastSync == nil {
		t.Error("expected lastSyncAt to be updated after incremental sync")
	}
}

func TestBatchUpsertAssets(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	assets := []AssetRow{
		{ImmichID: "b1", Type: "IMAGE", OriginalFileName: "b1.jpg", FileCreatedAt: "2024-01-01T00:00:00Z", Latitude: ptr(48.85), Longitude: ptr(2.35)},
		{ImmichID: "b2", Type: "IMAGE", OriginalFileName: "b2.jpg", FileCreatedAt: "2024-01-02T00:00:00Z"},
		{ImmichID: "b3", Type: "IMAGE", OriginalFileName: "b3.jpg", FileCreatedAt: "2024-01-03T00:00:00Z", Latitude: ptr(40.71), Longitude: ptr(-74.0)},
	}

	if err := db.upsertAssets(ctx, testUserID, assets); err != nil {
		t.Fatalf("upsertAssets: %v", err)
	}

	total, _ := db.countAssets(ctx, testUserID)
	if total != 3 {
		t.Errorf("expected 3 assets, got %d", total)
	}

	withGPS, err := db.countFilteredAssets(ctx, testUserID, "", true, "all", "", "")
	if err != nil {
		t.Fatalf("countFilteredAssets: %v", err)
	}
	if withGPS != 2 {
		t.Errorf("expected 2 with GPS, got %d", withGPS)
	}
}
