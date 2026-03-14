package main

import (
	"encoding/xml"
	"fmt"
	"math"
	"sort"
	"sync"
	"time"

	"github.com/ringsaturn/tzf"
)

const coordTolerance = 1e-6

var trackPointTimeFormats = []string{
	time.RFC3339,
	time.RFC3339Nano,
	"2006-01-02T15:04:05.999999999",
	"2006-01-02T15:04:05",
	"2006-01-02 15:04:05.999999999",
	"2006-01-02 15:04:05",
}

func parseTrackPointTime(raw string) (time.Time, bool) {
	for _, format := range trackPointTimeFormats {
		t, err := time.Parse(format, raw)
		if err == nil {
			return t, true
		}
	}
	return time.Time{}, false
}

var (
	tzFinder     tzf.F
	tzFinderOnce sync.Once
	tzFinderErr  error
)

func getTimezoneFinder() (tzf.F, error) {
	tzFinderOnce.Do(func() {
		tzFinder, tzFinderErr = tzf.NewDefaultFinder()
	})
	return tzFinder, tzFinderErr
}

func coordsMatch(current *float64, target float64) bool {
	if current == nil {
		return false
	}
	return math.Abs(*current-target) < coordTolerance
}

type gpxFile struct {
	XMLName xml.Name `xml:"gpx"`
	Tracks  []gpxTrack `xml:"trk"`
}

type gpxTrack struct {
	Name     string       `xml:"name"`
	Segments []gpxSegment `xml:"trkseg"`
}

type gpxSegment struct {
	Points []gpxPoint `xml:"trkpt"`
}

type gpxPoint struct {
	Lat  float64 `xml:"lat,attr"`
	Lon  float64 `xml:"lon,attr"`
	Ele  float64 `xml:"ele"`
	Time string  `xml:"time"`
}

type trackPoint struct {
	latitude  float64
	longitude float64
	elevation float64
	time      time.Time
}

type parsedGPX struct {
	name   string
	points []trackPoint
}

func parseGPX(data []byte) (parsedGPX, error) {
	var gpx gpxFile
	if err := xml.Unmarshal(data, &gpx); err != nil {
		return parsedGPX{}, fmt.Errorf("invalid GPX XML: %w", err)
	}

	var trackName string
	var points []trackPoint
	var skippedCount int
	for _, trk := range gpx.Tracks {
		if trackName == "" && trk.Name != "" {
			trackName = trk.Name
		}
		for _, seg := range trk.Segments {
			for _, pt := range seg.Points {
				t, ok := parseTrackPointTime(pt.Time)
				if !ok {
					skippedCount++
					continue
				}
				points = append(points, trackPoint{
					latitude:  pt.Lat,
					longitude: pt.Lon,
					elevation: pt.Ele,
					time:      t,
				})
			}
		}
	}

	if len(points) < 2 {
		if skippedCount > 0 {
			return parsedGPX{}, fmt.Errorf("GPX file must contain at least 2 trackpoints with valid timestamps, found %d valid (%d skipped)", len(points), skippedCount)
		}
		return parsedGPX{}, fmt.Errorf("GPX file must contain at least 2 trackpoints, found %d", len(points))
	}

	sort.Slice(points, func(i, j int) bool {
		return points[i].time.Before(points[j].time)
	})

	return parsedGPX{name: trackName, points: points}, nil
}

func matchAssetsToTrack(assets []AssetRow, track []trackPoint, maxGapSeconds int, trackTimezone *time.Location) []GPXMatchResult {
	if len(track) < 2 {
		return []GPXMatchResult{}
	}

	trackStart := track[0].time
	trackEnd := track[len(track)-1].time
	maxGap := time.Duration(maxGapSeconds) * time.Second

	matches := []GPXMatchResult{}

	for _, asset := range assets {
		if asset.DateTimeOriginal == nil {
			continue
		}

		raw := *asset.DateTimeOriginal
		assetTime, err := time.Parse(time.RFC3339, raw)
		if err == nil {
			assetTime = assetTime.UTC()
		} else {
			naive, naiveErr := time.Parse("2006-01-02T15:04:05", raw)
			if naiveErr != nil {
				continue
			}
			assetTime = time.Date(naive.Year(), naive.Month(), naive.Day(), naive.Hour(), naive.Minute(), naive.Second(), naive.Nanosecond(), trackTimezone).UTC()
		}

		if assetTime.Before(trackStart.Add(-maxGap)) || assetTime.After(trackEnd.Add(maxGap)) {
			continue
		}

		idx := sort.Search(len(track), func(i int) bool {
			return !track[i].time.Before(assetTime)
		})

		if idx == 0 {
			gap := track[0].time.Sub(assetTime)
			if gap > maxGap {
				continue
			}
			alreadyApplied := coordsMatch(asset.Latitude, track[0].latitude) && coordsMatch(asset.Longitude, track[0].longitude)
			matches = append(matches, GPXMatchResult{
				AssetID:          asset.ImmichID,
				FileName:         asset.OriginalFileName,
				Latitude:         track[0].latitude,
				Longitude:        track[0].longitude,
				Elevation:        track[0].elevation,
				TimeGap:          int(gap.Seconds()),
				IsAlreadyApplied: alreadyApplied,
			})
			continue
		}

		if idx >= len(track) {
			gap := assetTime.Sub(track[len(track)-1].time)
			if gap > maxGap {
				continue
			}
			last := track[len(track)-1]
			alreadyApplied := coordsMatch(asset.Latitude, last.latitude) && coordsMatch(asset.Longitude, last.longitude)
			matches = append(matches, GPXMatchResult{
				AssetID:          asset.ImmichID,
				FileName:         asset.OriginalFileName,
				Latitude:         last.latitude,
				Longitude:        last.longitude,
				Elevation:        last.elevation,
				TimeGap:          int(gap.Seconds()),
				IsAlreadyApplied: alreadyApplied,
			})
			continue
		}

		before := track[idx-1]
		after := track[idx]
		gap := after.time.Sub(before.time)
		if gap > maxGap {
			continue
		}

		ratio := float64(assetTime.Sub(before.time)) / float64(gap)
		lat := before.latitude + ratio*(after.latitude-before.latitude)
		lon := before.longitude + ratio*(after.longitude-before.longitude)
		ele := before.elevation + ratio*(after.elevation-before.elevation)

		closerGap := assetTime.Sub(before.time)
		afterGap := after.time.Sub(assetTime)
		if afterGap < closerGap {
			closerGap = afterGap
		}

		alreadyApplied := coordsMatch(asset.Latitude, lat) && coordsMatch(asset.Longitude, lon)
		matches = append(matches, GPXMatchResult{
			AssetID:          asset.ImmichID,
			FileName:         asset.OriginalFileName,
			Latitude:         lat,
			Longitude:        lon,
			Elevation:        ele,
			TimeGap:          int(closerGap.Seconds()),
			IsAlreadyApplied: alreadyApplied,
		})
	}

	return matches
}

func buildTrackSummary(name string, track []trackPoint, maxPoints int) GPXTrackSummary {
	if len(track) == 0 {
		return GPXTrackSummary{Name: name}
	}
	summary := GPXTrackSummary{
		Name:       name,
		PointCount: len(track),
		StartTime:  track[0].time.Format(time.RFC3339),
		EndTime:    track[len(track)-1].time.Format(time.RFC3339),
	}

	if len(track) <= maxPoints {
		summary.Points = make([]GPXTrackPoint, len(track))
		for i, pt := range track {
			summary.Points[i] = GPXTrackPoint{
				Latitude:  pt.latitude,
				Longitude: pt.longitude,
			}
		}
		return summary
	}

	summary.Points = make([]GPXTrackPoint, 0, maxPoints)
	step := float64(len(track)-1) / float64(maxPoints-1)
	for i := 0; i < maxPoints; i++ {
		idx := int(float64(i) * step)
		if idx >= len(track) {
			idx = len(track) - 1
		}
		summary.Points = append(summary.Points, GPXTrackPoint{
			Latitude:  track[idx].latitude,
			Longitude: track[idx].longitude,
		})
	}

	return summary
}
