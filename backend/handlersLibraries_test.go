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

func newTestLibraryHandlers(t *testing.T, immichHandler http.HandlerFunc) (*LibraryHandlers, *Database, *http.ServeMux) {
	t.Helper()
	db := newTestDB(t)
	server := httptest.NewServer(immichHandler)
	t.Cleanup(server.Close)
	factory := &ImmichClientFactory{
		baseURL:    server.URL,
		httpClient: &http.Client{Timeout: 5 * time.Second},
	}
	syncService := newSyncService(db, factory, newNominatimClient(10 * time.Second))
	syncService.shutdownCtx = context.Background()
	handlers := newLibraryHandlers(db, factory, syncService)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /libraries", handlers.handleGetLibraries)
	mux.HandleFunc("PUT /libraries/{libraryID}", handlers.handleUpdateLibrary)
	mux.HandleFunc("POST /libraries/refresh", handlers.handleRefreshLibraries)

	return handlers, db, mux
}

func TestHandleGetLibrariesEmpty(t *testing.T) {
	_, db, mux := newTestLibraryHandlers(t, func(w http.ResponseWriter, r *http.Request) {
		http.NotFound(w, r)
	})
	db.setSyncState(context.Background(), testUserID, "hasLibraryAccess", "true")

	req := withTestUser(httptest.NewRequest("GET", "/libraries", nil))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var libs []LibraryRow
	json.NewDecoder(rec.Body).Decode(&libs)
	if len(libs) != 0 {
		t.Errorf("expected 0 libraries, got %d", len(libs))
	}
}

func TestHandleGetLibrariesWithData(t *testing.T) {
	_, db, mux := newTestLibraryHandlers(t, func(w http.ResponseWriter, r *http.Request) {
		http.NotFound(w, r)
	})

	ctx := context.Background()
	db.setSyncState(ctx, testUserID, "hasLibraryAccess", "true")
	db.upsertLibrary(ctx,"lib1", "Photos", 100)
	db.upsertLibrary(ctx,"lib2", "Archive", 50)

	req := withTestUser(httptest.NewRequest("GET", "/libraries", nil))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var libs []LibraryRow
	json.NewDecoder(rec.Body).Decode(&libs)
	if len(libs) != 2 {
		t.Errorf("expected 2 libraries, got %d", len(libs))
	}
}

func TestHandleUpdateLibrarySuccess(t *testing.T) {
	_, db, mux := newTestLibraryHandlers(t, func(w http.ResponseWriter, r *http.Request) {
		http.NotFound(w, r)
	})

	ctx := context.Background()
	db.upsertLibrary(ctx,"lib1", "Photos", 100)
	db.setSyncState(ctx, testUserID, "hasLibraryAccess", "true")

	req := withTestUser(httptest.NewRequest("PUT", "/libraries/lib1", strings.NewReader(`{"isHidden":true}`)))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", rec.Code, rec.Body.String())
	}

	libs, _ := db.getLibraries(ctx)
	if !libs[0].IsHidden {
		t.Error("expected library to be hidden after update")
	}
}

func TestHandleUpdateLibraryNotFound(t *testing.T) {
	_, db, mux := newTestLibraryHandlers(t, func(w http.ResponseWriter, r *http.Request) {
		http.NotFound(w, r)
	})

	db.setSyncState(context.Background(), testUserID, "hasLibraryAccess", "true")

	req := withTestUser(httptest.NewRequest("PUT", "/libraries/nonexistent", strings.NewReader(`{"isHidden":true}`)))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", rec.Code)
	}
}

func TestHandleUpdateLibraryBadBody(t *testing.T) {
	_, db, mux := newTestLibraryHandlers(t, func(w http.ResponseWriter, r *http.Request) {
		http.NotFound(w, r)
	})

	db.setSyncState(context.Background(), testUserID, "hasLibraryAccess", "true")

	req := withTestUser(httptest.NewRequest("PUT", "/libraries/lib1", strings.NewReader(`{bad}`)))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rec.Code)
	}
}

func TestHandleUpdateLibraryMissingField(t *testing.T) {
	_, db, mux := newTestLibraryHandlers(t, func(w http.ResponseWriter, r *http.Request) {
		http.NotFound(w, r)
	})

	db.setSyncState(context.Background(), testUserID, "hasLibraryAccess", "true")

	req := withTestUser(httptest.NewRequest("PUT", "/libraries/lib1", strings.NewReader(`{}`)))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for missing isHidden, got %d", rec.Code)
	}
}

func TestHandleRefreshLibraries(t *testing.T) {
	_, db, mux := newTestLibraryHandlers(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/libraries" {
			json.NewEncoder(w).Encode([]ImmichLibraryResponse{
				{ID: "lib1", Name: "Photos", AssetCount: 100},
			})
			return
		}
		http.NotFound(w, r)
	})

	ctx := context.Background()
	db.setSyncState(ctx, testUserID, "hasLibraryAccess", "true")

	req := withTestUser(httptest.NewRequest("POST", "/libraries/refresh", nil))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", rec.Code, rec.Body.String())
	}

	var libs []LibraryRow
	json.NewDecoder(rec.Body).Decode(&libs)
	if len(libs) != 1 {
		t.Errorf("expected 1 library after refresh, got %d", len(libs))
	}

	dbLibs, _ := db.getLibraries(ctx)
	if len(dbLibs) != 1 {
		t.Errorf("expected 1 library in DB after refresh, got %d", len(dbLibs))
	}
}

func TestHandleRefreshLibrariesFailure(t *testing.T) {
	_, db, mux := newTestLibraryHandlers(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusForbidden)
	})

	db.setSyncState(context.Background(), testUserID, "hasLibraryAccess", "true")

	req := withTestUser(httptest.NewRequest("POST", "/libraries/refresh", nil))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadGateway {
		t.Errorf("expected 502 on refresh failure, got %d", rec.Code)
	}
}

func TestHandleUpdateLibraryForbiddenWithoutAccess(t *testing.T) {
	_, _, mux := newTestLibraryHandlers(t, func(w http.ResponseWriter, r *http.Request) {
		http.NotFound(w, r)
	})

	req := withTestUser(httptest.NewRequest("PUT", "/libraries/lib1", strings.NewReader(`{"isHidden":true}`)))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Errorf("expected 403 for non-admin, got %d", rec.Code)
	}
}

func TestHandleGetLibrariesForbiddenWithoutAccess(t *testing.T) {
	_, _, mux := newTestLibraryHandlers(t, func(w http.ResponseWriter, r *http.Request) {
		http.NotFound(w, r)
	})

	req := withTestUser(httptest.NewRequest("GET", "/libraries", nil))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Errorf("expected 403 for non-admin, got %d", rec.Code)
	}
}

func TestHandleRefreshLibrariesDoesNotRequireStoredAccessFlag(t *testing.T) {
	_, _, mux := newTestLibraryHandlers(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/libraries" {
			json.NewEncoder(w).Encode([]ImmichLibraryResponse{})
			return
		}
		http.NotFound(w, r)
	})

	req := withTestUser(httptest.NewRequest("POST", "/libraries/refresh", nil))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected 200 without stored access flag, got %d", rec.Code)
	}
}

func TestHandleGetLibrariesUnauthorized(t *testing.T) {
	_, _, mux := newTestLibraryHandlers(t, func(w http.ResponseWriter, r *http.Request) {
		http.NotFound(w, r)
	})

	req := httptest.NewRequest("GET", "/libraries", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rec.Code)
	}
}
