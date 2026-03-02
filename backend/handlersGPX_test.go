package main

import (
	"bytes"
	"context"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"
)

func newTestGPXHandlers(t *testing.T) (*Handlers, *http.ServeMux) {
	t.Helper()
	handlers, mux := newTestHandlers(t)
	mux.HandleFunc("POST /gpx/preview", handlers.handleGPXPreview)
	return handlers, mux
}

func TestGPXPreviewEndpoint(t *testing.T) {
	_, mux := newTestGPXHandlers(t)

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, _ := writer.CreateFormFile("gpxFile", "test.gpx")
	part.Write([]byte(testGPX))
	writer.Close()

	req := withTestUser(httptest.NewRequest("POST", "/gpx/preview", &body))
	req.Header.Set("Content-Type", writer.FormDataContentType())
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp GPXPreviewResponse
	json.NewDecoder(rec.Body).Decode(&resp)
	if resp.Track.PointCount != 4 {
		t.Errorf("expected 4 track points, got %d", resp.Track.PointCount)
	}
	if len(resp.Matches) != 0 {
		t.Errorf("expected 0 matches with no assets, got %d", len(resp.Matches))
	}
	if resp.DetectedTimezone == "" {
		t.Error("expected non-empty DetectedTimezone")
	}
}

func TestGPXPreviewWithMatchingAssets(t *testing.T) {
	handlers, mux := newTestGPXHandlers(t)

	dto := "2026-02-10T10:30:00Z"
	err := handlers.db.(*Database).upsertAssets(context.Background(), testUserID, []AssetRow{
		{
			ImmichID:         "asset-1",
			OriginalFileName: "IMG_001.jpg",
			Type:             "IMAGE",
			FileCreatedAt:    "2026-02-10T10:30:00Z",
			DateTimeOriginal: &dto,
		},
	})
	if err != nil {
		t.Fatalf("failed to seed asset: %v", err)
	}

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, _ := writer.CreateFormFile("gpxFile", "test.gpx")
	part.Write([]byte(testGPX))
	writer.WriteField("maxGapSeconds", "3600")
	writer.Close()

	req := withTestUser(httptest.NewRequest("POST", "/gpx/preview", &body))
	req.Header.Set("Content-Type", writer.FormDataContentType())
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp GPXPreviewResponse
	json.NewDecoder(rec.Body).Decode(&resp)
	if len(resp.Matches) != 1 {
		t.Fatalf("expected 1 match, got %d", len(resp.Matches))
	}
	if resp.Matches[0].AssetID != "asset-1" {
		t.Errorf("expected asset-1, got %s", resp.Matches[0].AssetID)
	}
	if resp.DetectedTimezone == "" {
		t.Error("expected non-empty DetectedTimezone")
	}
}

func TestGPXPreviewInvalidFile(t *testing.T) {
	_, mux := newTestGPXHandlers(t)

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, _ := writer.CreateFormFile("gpxFile", "bad.gpx")
	part.Write([]byte("not valid xml at all"))
	writer.Close()

	req := withTestUser(httptest.NewRequest("POST", "/gpx/preview", &body))
	req.Header.Set("Content-Type", writer.FormDataContentType())
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rec.Code)
	}
}

func TestGPXPreviewMissingFile(t *testing.T) {
	_, mux := newTestGPXHandlers(t)

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	writer.Close()

	req := withTestUser(httptest.NewRequest("POST", "/gpx/preview", &body))
	req.Header.Set("Content-Type", writer.FormDataContentType())
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rec.Code)
	}
}

func TestGPXPreviewUnauthenticated(t *testing.T) {
	_, mux := newTestGPXHandlers(t)

	req := httptest.NewRequest("POST", "/gpx/preview", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rec.Code)
	}
}

