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

func TestParseGPXIssue23NokiaSportsTracker(t *testing.T) {
	gpx := `<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="Nokia Sports Tracker" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
<metadata>
<name>07.01.2010 14:36</name>
<desc>Test</desc>
<author><name>Test1</name></author>
<time>2010-01-07T14:37:04.96</time>
</metadata>
<trk>
<name>07.01.2010 14:36</name>
<trkseg>
<trkpt lat="47.271980" lon="11.785735">
<ele>1813.0</ele>
<speed>3.5</speed>
<course>214.9</course>
<desc>Speed 3.5 km/h Distance 0.00 km</desc>
<time>2010-01-07T14:37:39.99</time>
<name>1</name>
</trkpt>
<trkpt lat="47.271635" lon="11.785380">
<ele>1813.0</ele>
<speed>4.9</speed>
<course>151.4</course>
<desc>Speed 4.9 km/h Distance 0.05 km</desc>
<time>2010-01-07T14:37:45.33</time>
<name>2</name>
</trkpt>
<trkpt lat="47.271618" lon="11.785393">
<ele>1813.0</ele>
<speed>3.4</speed>
<course>259.4</course>
<desc>Speed 3.4 km/h Distance 0.05 km</desc>
<time>2010-01-07T14:37:46.33</time>
<name>3</name>
</trkpt>
<trkpt lat="47.271023" lon="11.780713">
<ele>1730.5</ele>
<speed>2.4</speed>
<course>217.9</course>
<desc>Speed 2.4 km/h Distance 0.41 km</desc>
<time>2010-01-07T14:37:50.63</time>
<name>4</name>
</trkpt>
</trkseg>
</trk>
</gpx>`
	result, err := parseGPX([]byte(gpx))
	if err != nil {
		t.Fatalf("unexpected error parsing Nokia Sports Tracker GPX (issue #23): %v", err)
	}
	if len(result.points) != 4 {
		t.Fatalf("expected 4 points, got %d", len(result.points))
	}
	if result.name != "07.01.2010 14:36" {
		t.Errorf("expected track name '07.01.2010 14:36', got %q", result.name)
	}

	first := result.points[0]
	if first.latitude != 47.271980 {
		t.Errorf("first point latitude: expected 47.271980, got %f", first.latitude)
	}
	if first.longitude != 11.785735 {
		t.Errorf("first point longitude: expected 11.785735, got %f", first.longitude)
	}
	if first.elevation != 1813.0 {
		t.Errorf("first point elevation: expected 1813.0, got %f", first.elevation)
	}

	last := result.points[3]
	if last.latitude != 47.271023 {
		t.Errorf("last point latitude: expected 47.271023, got %f", last.latitude)
	}
	if last.longitude != 11.780713 {
		t.Errorf("last point longitude: expected 11.780713, got %f", last.longitude)
	}
	if last.elevation != 1730.5 {
		t.Errorf("last point elevation: expected 1730.5, got %f", last.elevation)
	}

	if !result.points[0].time.Before(result.points[1].time) {
		t.Error("points not sorted by time")
	}
}

func TestParseTrackPointTime(t *testing.T) {
	cases := []struct {
		name  string
		input string
	}{
		{"RFC3339 UTC", "2010-01-07T14:37:39Z"},
		{"RFC3339 offset", "2010-01-07T14:37:39+01:00"},
		{"RFC3339Nano UTC", "2010-01-07T14:37:39.123Z"},
		{"RFC3339Nano offset", "2010-01-07T14:37:39.123+01:00"},
		{"naive with fractional", "2010-01-07T14:37:39.99"},
		{"naive no fractional", "2010-01-07T14:37:39"},
		{"space with fractional", "2010-01-07 14:37:39.123"},
		{"space no fractional", "2010-01-07 14:37:39"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			result, ok := parseTrackPointTime(tc.input)
			if !ok {
				t.Fatalf("failed to parse %q", tc.input)
			}
			if result.Year() != 2010 || result.Month() != 1 || result.Day() != 7 {
				t.Errorf("wrong date from %q: got %v", tc.input, result)
			}
		})
	}
}

func TestParseTrackPointTimeInvalid(t *testing.T) {
	invalid := []string{
		"not-a-date",
		"07/01/2010 14:37:39",
		"2010-01-07",
		"",
	}
	for _, input := range invalid {
		_, ok := parseTrackPointTime(input)
		if ok {
			t.Errorf("expected failure for %q, but it parsed", input)
		}
	}
}
