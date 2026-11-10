package main

import (
	"encoding/json"
	"net/http/httptest"
	"sort"
	"strings"
	"testing"
)

func TestNormalizeViewportLongitudes(t *testing.T) {
	tests := []struct {
		name       string
		west, east float64
		wantWest   float64
		wantEast   float64
	}{
		{"already canonical", -5, 25, -5, 25},
		{"panned east across the antimeridian", 170, 190, 170, -170},
		{"panned west across the antimeridian", -200, -150, 160, -150},
		{"whole world copy to the east", 200, 220, -160, -140},
		{"east edge on the antimeridian", 0, 180, 0, 180},
		{"west edge on the antimeridian", 180, 200, 180, -160},
		{"wider than the world", -1000, 1000, -180, 180},
		{"already wrapped by the client", 170, -170, 170, -170},
		{"inverted out-of-range input left untouched", 190, -190, 190, -190},
		{"exactly the world width from an offset", 0, 360, -180, 180},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			west, east := normalizeViewportLongitudes(tt.west, tt.east)
			if west != tt.wantWest || east != tt.wantEast {
				t.Errorf("normalize(%v, %v) = (%v, %v), want (%v, %v)", tt.west, tt.east, west, east, tt.wantWest, tt.wantEast)
			}
		})
	}
}

func TestMapMarkersUnwrappedBounds(t *testing.T) {
	handlers, mux := newTestHandlers(t)
	db := handlers.db.(*Database)

	seedAsset(t, db, "fiji", ptr(-17.77), ptr(178.0), "2024-01-01T12:00:00Z")
	seedAsset(t, db, "samoa", ptr(-13.76), ptr(-172.1), "2024-01-02T12:00:00Z")
	seedAsset(t, db, "paris", ptr(48.85), ptr(2.35), "2024-01-03T12:00:00Z")

	tests := []struct {
		name  string
		query string
		want  []string
	}{
		{"viewport panned past 180", "/map-markers?north=-10&south=-20&east=190&west=170", []string{"fiji", "samoa"}},
		{"viewport panned past -180", "/map-markers?north=-10&south=-20&east=-170&west=-190", []string{"fiji", "samoa"}},
		{"zoomed out on a world copy", "/map-markers?north=85&south=-85&east=2000&west=0", []string{"fiji", "paris", "samoa"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			mux.ServeHTTP(rec, withTestUser(httptest.NewRequest("GET", tt.query, nil)))
			if rec.Code != 200 {
				t.Fatalf("expected 200, got %d (body: %s)", rec.Code, rec.Body.String())
			}
			var markers []MapMarker
			if err := json.Unmarshal(rec.Body.Bytes(), &markers); err != nil {
				t.Fatalf("decode markers: %v", err)
			}
			var got []string
			for _, marker := range markers {
				got = append(got, marker.ImmichID)
			}
			sort.Strings(got)
			if strings.Join(got, ",") != strings.Join(tt.want, ",") {
				t.Errorf("expected %v, got %v", tt.want, got)
			}
		})
	}
}
