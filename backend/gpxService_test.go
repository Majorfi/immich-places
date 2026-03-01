package main

import (
	"math"
	"testing"
	"time"
)

const testGPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1">
  <trk>
    <trkseg>
      <trkpt lat="40.0" lon="9.0">
        <ele>100.0</ele>
        <time>2026-02-10T10:00:00Z</time>
      </trkpt>
      <trkpt lat="40.1" lon="9.1">
        <ele>200.0</ele>
        <time>2026-02-10T11:00:00Z</time>
      </trkpt>
      <trkpt lat="40.2" lon="9.2">
        <ele>300.0</ele>
        <time>2026-02-10T12:00:00Z</time>
      </trkpt>
      <trkpt lat="40.3" lon="9.3">
        <ele>400.0</ele>
        <time>2026-02-10T13:00:00Z</time>
      </trkpt>
    </trkseg>
  </trk>
</gpx>`

func TestParseGPX(t *testing.T) {
	gpx, err := parseGPX([]byte(testGPX))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(gpx.points) != 4 {
		t.Fatalf("expected 4 points, got %d", len(gpx.points))
	}
	if gpx.points[0].latitude != 40.0 || gpx.points[0].longitude != 9.0 {
		t.Errorf("first point: expected (40.0, 9.0), got (%f, %f)", gpx.points[0].latitude, gpx.points[0].longitude)
	}
	if gpx.points[0].elevation != 100.0 {
		t.Errorf("first point elevation: expected 100.0, got %f", gpx.points[0].elevation)
	}
	if !gpx.points[0].time.Before(gpx.points[1].time) {
		t.Error("points not sorted by time")
	}
}

func TestParseGPXInvalid(t *testing.T) {
	_, err := parseGPX([]byte("not xml"))
	if err == nil {
		t.Error("expected error for invalid XML")
	}
}

func TestParseGPXTooFewPoints(t *testing.T) {
	gpx := `<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1">
  <trk><trkseg>
    <trkpt lat="40.0" lon="9.0"><ele>100</ele><time>2026-02-10T10:00:00Z</time></trkpt>
  </trkseg></trk>
</gpx>`
	_, err := parseGPX([]byte(gpx))
	if err == nil {
		t.Error("expected error for single trackpoint")
	}
}

func TestMatchAssetsToTrack(t *testing.T) {
	gpxResult, _ := parseGPX([]byte(testGPX))
	track := gpxResult.points

	halfHour := "2026-02-10T10:30:00Z"
	noGPS := func(id, fileName, dto string) AssetRow {
		return AssetRow{
			ImmichID:         id,
			OriginalFileName: fileName,
			DateTimeOriginal: &dto,
		}
	}

	assets := []AssetRow{
		noGPS("a1", "IMG_001.jpg", halfHour),
	}

	matches := matchAssetsToTrack(assets, track, 3600, time.UTC)
	if len(matches) != 1 {
		t.Fatalf("expected 1 match, got %d", len(matches))
	}

	m := matches[0]
	if m.AssetID != "a1" {
		t.Errorf("expected assetID a1, got %s", m.AssetID)
	}
	if math.Abs(m.Latitude-40.05) > 0.001 {
		t.Errorf("expected latitude ~40.05, got %f", m.Latitude)
	}
	if math.Abs(m.Longitude-9.05) > 0.001 {
		t.Errorf("expected longitude ~9.05, got %f", m.Longitude)
	}
	if math.Abs(m.Elevation-150.0) > 1.0 {
		t.Errorf("expected elevation ~150.0, got %f", m.Elevation)
	}
	if m.IsAlreadyApplied {
		t.Error("expected IsAlreadyApplied=false for asset without GPS")
	}
}

func TestMatchAssetsIsAlreadyApplied(t *testing.T) {
	gpxResult, _ := parseGPX([]byte(testGPX))
	track := gpxResult.points

	halfHour := "2026-02-10T10:30:00Z"
	matchedLat := 40.05
	matchedLon := 9.05
	differentLat := 50.0
	differentLon := 10.0

	assets := []AssetRow{
		{ImmichID: "applied", OriginalFileName: "applied.jpg", DateTimeOriginal: &halfHour, Latitude: &matchedLat, Longitude: &matchedLon},
		{ImmichID: "different", OriginalFileName: "different.jpg", DateTimeOriginal: &halfHour, Latitude: &differentLat, Longitude: &differentLon},
		{ImmichID: "nogps", OriginalFileName: "nogps.jpg", DateTimeOriginal: &halfHour},
	}

	matches := matchAssetsToTrack(assets, track, 3600, time.UTC)
	if len(matches) != 3 {
		t.Fatalf("expected 3 matches, got %d", len(matches))
	}

	byID := map[string]GPXMatchResult{}
	for _, m := range matches {
		byID[m.AssetID] = m
	}

	if !byID["applied"].IsAlreadyApplied {
		t.Error("expected IsAlreadyApplied=true for asset with matching coords")
	}
	if byID["different"].IsAlreadyApplied {
		t.Error("expected IsAlreadyApplied=false for asset with different coords")
	}
	if byID["nogps"].IsAlreadyApplied {
		t.Error("expected IsAlreadyApplied=false for asset with no GPS")
	}
}

func TestMatchAssetsIncludesExistingGPS(t *testing.T) {
	gpxResult, _ := parseGPX([]byte(testGPX))
	track := gpxResult.points

	dto := "2026-02-10T10:30:00Z"
	lat := 50.0
	lon := 10.0
	assets := []AssetRow{
		{ImmichID: "a1", OriginalFileName: "IMG_001.jpg", DateTimeOriginal: &dto, Latitude: &lat, Longitude: &lon},
	}

	matches := matchAssetsToTrack(assets, track, 3600, time.UTC)
	if len(matches) != 1 {
		t.Fatalf("expected 1 match for asset with existing GPS, got %d", len(matches))
	}
	if matches[0].IsAlreadyApplied {
		t.Error("expected IsAlreadyApplied=false since existing coords differ from interpolated position")
	}
}

func TestMatchAssetsOutsideTrackRange(t *testing.T) {
	gpxResult, _ := parseGPX([]byte(testGPX))
	track := gpxResult.points

	dto := "2026-02-11T10:00:00Z"
	assets := []AssetRow{
		{ImmichID: "a1", OriginalFileName: "IMG_001.jpg", DateTimeOriginal: &dto},
	}

	matches := matchAssetsToTrack(assets, track, 600, time.UTC)
	if len(matches) != 0 {
		t.Errorf("expected 0 matches for out-of-range asset, got %d", len(matches))
	}
}

func TestMatchAssetsGapThreshold(t *testing.T) {
	gpx := `<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1">
  <trk><trkseg>
    <trkpt lat="40.0" lon="9.0"><ele>100</ele><time>2026-02-10T10:00:00Z</time></trkpt>
    <trkpt lat="40.1" lon="9.1"><ele>200</ele><time>2026-02-10T12:00:00Z</time></trkpt>
  </trkseg></trk>
</gpx>`
	gpxResult, _ := parseGPX([]byte(gpx))
	track := gpxResult.points

	dto := "2026-02-10T11:00:00Z"
	assets := []AssetRow{
		{ImmichID: "a1", OriginalFileName: "IMG_001.jpg", DateTimeOriginal: &dto},
	}

	matches := matchAssetsToTrack(assets, track, 60, time.UTC)
	if len(matches) != 0 {
		t.Errorf("expected 0 matches when gap exceeds threshold, got %d", len(matches))
	}

	matches = matchAssetsToTrack(assets, track, 7200, time.UTC)
	if len(matches) != 1 {
		t.Errorf("expected 1 match with larger threshold, got %d", len(matches))
	}
}

func TestMatchAssetsNaiveTimestampWithTimezone(t *testing.T) {
	gpxResult, _ := parseGPX([]byte(testGPX))
	track := gpxResult.points

	rome, _ := time.LoadLocation("Europe/Rome")

	dto := "2026-02-10T11:30:00"
	assets := []AssetRow{
		{ImmichID: "a1", OriginalFileName: "IMG_001.jpg", DateTimeOriginal: &dto},
	}

	matches := matchAssetsToTrack(assets, track, 3600, rome)
	if len(matches) != 1 {
		t.Fatalf("expected 1 match with naive timestamp in Europe/Rome, got %d", len(matches))
	}
	if math.Abs(matches[0].Latitude-40.05) > 0.001 {
		t.Errorf("expected latitude ~40.05, got %f", matches[0].Latitude)
	}
}

func TestMatchAssetsRFC3339NotAdjusted(t *testing.T) {
	gpxResult, _ := parseGPX([]byte(testGPX))
	track := gpxResult.points

	rome, _ := time.LoadLocation("Europe/Rome")

	dto := "2026-02-10T11:30:00+01:00"
	assets := []AssetRow{
		{ImmichID: "a1", OriginalFileName: "IMG_001.jpg", DateTimeOriginal: &dto},
	}

	matches := matchAssetsToTrack(assets, track, 3600, rome)
	if len(matches) != 1 {
		t.Fatalf("expected 1 match with RFC3339 timestamp, got %d", len(matches))
	}
	if math.Abs(matches[0].Latitude-40.05) > 0.001 {
		t.Errorf("expected latitude ~40.05, got %f", matches[0].Latitude)
	}
}

func TestBuildTrackSummary(t *testing.T) {
	gpxResult, _ := parseGPX([]byte(testGPX))
	track := gpxResult.points

	summary := buildTrackSummary("", track, 200)
	if summary.PointCount != 4 {
		t.Errorf("expected pointCount 4, got %d", summary.PointCount)
	}
	if len(summary.Points) != 4 {
		t.Errorf("expected 4 summary points (no downsampling needed), got %d", len(summary.Points))
	}
	if summary.StartTime == "" || summary.EndTime == "" {
		t.Error("expected non-empty start/end times")
	}
}

func TestBuildTrackSummaryDownsamples(t *testing.T) {
	points := make([]trackPoint, 1000)
	base := time.Date(2026, 2, 10, 10, 0, 0, 0, time.UTC)
	for i := range points {
		points[i] = trackPoint{
			latitude:  40.0 + float64(i)*0.001,
			longitude: 9.0 + float64(i)*0.001,
			elevation: 100.0,
			time:      base.Add(time.Duration(i) * time.Second),
		}
	}

	summary := buildTrackSummary("", points, 200)
	if len(summary.Points) != 200 {
		t.Errorf("expected 200 downsampled points, got %d", len(summary.Points))
	}
	if summary.PointCount != 1000 {
		t.Errorf("expected pointCount 1000, got %d", summary.PointCount)
	}
}
