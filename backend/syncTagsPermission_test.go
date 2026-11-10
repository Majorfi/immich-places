package main

import (
	"bytes"
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"testing"
	"time"
)

func TestFullSyncLogsTagPermissionError(t *testing.T) {
	factory, immich := newMockImmichFactory(t, func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/search/metadata":
			json.NewEncoder(w).Encode(ImmichSearchResponse{})
		case "/api/stacks":
			json.NewEncoder(w).Encode([]ImmichStackResponse{})
		case "/api/albums":
			json.NewEncoder(w).Encode([]ImmichAlbumResponse{})
		case "/api/libraries":
			json.NewEncoder(w).Encode([]ImmichLibraryResponse{})
		case "/api/tags":
			w.WriteHeader(http.StatusForbidden)
		default:
			http.NotFound(w, r)
		}
	})

	var logs bytes.Buffer
	previousOutput := log.Writer()
	log.SetOutput(&logs)
	t.Cleanup(func() { log.SetOutput(previousOutput) })

	db := newTestDB(t)
	svc := newSyncService(db, factory, newNominatimClient(10*time.Second))
	svc.doUserFullSync(context.Background(), testUserID, immich)

	if !strings.Contains(logs.String(), "album/tag error") || !strings.Contains(logs.String(), "HTTP 403") {
		t.Errorf("expected the tag sync failure in the logs, got:\n%s", logs.String())
	}
	lastSyncError, err := db.getSyncState(context.Background(), testUserID, "lastSyncError")
	if err != nil || lastSyncError == nil || !strings.Contains(*lastSyncError, "HTTP 403") {
		t.Errorf("expected lastSyncError to record the 403, got %v (err %v)", lastSyncError, err)
	}
}
