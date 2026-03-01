package main

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"time"
)

const (
	defaultMaxGapSeconds  = 600
	maxTrackSummaryPoints = 200
	maxGPXFileSize        = 10_000_000
)

func (h *Handlers) handleGPXPreview(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r)
	if user == nil {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}

	if err := r.ParseMultipartForm(maxGPXFileSize); err != nil {
		writeError(w, http.StatusBadRequest, "failed to parse multipart form")
		return
	}

	file, _, err := r.FormFile("gpxFile")
	if err != nil {
		writeError(w, http.StatusBadRequest, "gpxFile is required")
		return
	}
	defer file.Close()

	gpxData, err := io.ReadAll(io.LimitReader(file, maxGPXFileSize))
	if err != nil {
		writeError(w, http.StatusBadRequest, "failed to read GPX file")
		return
	}

	maxGapSeconds := defaultMaxGapSeconds
	if val := r.FormValue("maxGapSeconds"); val != "" {
		parsed, err := strconv.Atoi(val)
		if err != nil || parsed < 0 {
			writeError(w, http.StatusBadRequest, "maxGapSeconds must be a non-negative integer")
			return
		}
		maxGapSeconds = parsed
	}

	includeGeotagged := r.FormValue("includeGeotagged") == "true"

	gpx, err := parseGPX(gpxData)
	if err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("invalid GPX file: %v", err))
		return
	}

	finder, err := getTimezoneFinder()
	if err != nil {
		log.Printf("Failed to init timezone finder: %v", err)
		writeError(w, http.StatusInternalServerError, "failed to initialize timezone lookup")
		return
	}
	midIdx := len(gpx.points) / 2
	timezoneName := finder.GetTimezoneName(gpx.points[midIdx].longitude, gpx.points[midIdx].latitude)
	trackTimezone, err := time.LoadLocation(timezoneName)
	if err != nil {
		log.Printf("Failed to load timezone %q, falling back to UTC: %v", timezoneName, err)
		trackTimezone = time.UTC
	}

	assets, err := h.db.getAssetsWithTimestamps(r.Context(), user.ID, includeGeotagged)
	if err != nil {
		log.Printf("Failed to query timestamped assets for GPX matching: %v", err)
		writeError(w, http.StatusInternalServerError, "failed to query assets")
		return
	}

	matches := matchAssetsToTrack(assets, gpx.points, maxGapSeconds, trackTimezone)

	summary := buildTrackSummary(gpx.name, gpx.points, maxTrackSummaryPoints)

	writeJSON(w, http.StatusOK, GPXPreviewResponse{
		Track:            summary,
		Matches:          matches,
		DetectedTimezone: trackTimezone.String(),
	})
}

