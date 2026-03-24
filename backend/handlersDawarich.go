package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"
)

type DawarichHandlers struct {
	db              *Database
	dawarichURL     string
	dawarichSync    *DawarichSyncService
	defaultTimezone *time.Location
}

func newDawarichHandlers(db *Database, dawarichURL string, dawarichSync *DawarichSyncService, defaultTimezone *time.Location) *DawarichHandlers {
	return &DawarichHandlers{db: db, dawarichURL: dawarichURL, dawarichSync: dawarichSync, defaultTimezone: defaultTimezone}
}

func decodeRequestBody(w http.ResponseWriter, r *http.Request, dst interface{}, validationMessage string) bool {
	decoder := json.NewDecoder(io.LimitReader(r.Body, 4096))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(dst); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return false
	}
	if err := validate.Struct(dst); err != nil {
		writeError(w, http.StatusBadRequest, validationMessage)
		return false
	}
	return true
}

func (h *DawarichHandlers) requireDawarichUser(w http.ResponseWriter, r *http.Request) (*UserRow, bool) {
	user := getUserFromContext(r)
	if user == nil {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return nil, false
	}
	if h.dawarichURL == "" || user.DawarichAPIKey == nil {
		writeError(w, http.StatusBadRequest, "Dawarich credentials not configured")
		return nil, false
	}
	return user, true
}

func (h *DawarichHandlers) respondWithRefreshedUser(w http.ResponseWriter, r *http.Request, userID string, label string) {
	updated, err := h.db.getUserByID(r.Context(), userID)
	if err != nil || updated == nil {
		log.Printf("[Dawarich] %s: failed to refetch user: %v", label, err)
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeMeResponse(w, r, h.db, updated)
}

func (h *DawarichHandlers) handleDawarichSettings(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r)
	if user == nil {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}

	if h.dawarichURL == "" {
		writeError(w, http.StatusBadRequest, "Dawarich URL not configured on server")
		return
	}

	var req DawarichSettingsRequest
	if !decodeRequestBody(w, r, &req, "API key is required") {
		return
	}

	client := newDawarichClient(h.dawarichURL, req.APIKey)
	if err := client.validateConnection(r.Context()); err != nil {
		log.Printf("[Dawarich] Settings validation failed for user %s: %v", user.ID, err)
		writeError(w, http.StatusBadRequest, "failed to connect to Dawarich, check your API key")
		return
	}

	if err := h.db.updateDawarichAPIKey(r.Context(), user.ID, &req.APIKey); err != nil {
		log.Printf("[Dawarich] Failed to save settings: %v", err)
		writeError(w, http.StatusInternalServerError, "failed to save settings")
		return
	}

	h.dawarichSync.triggerUserSync(user.ID, req.APIKey)

	h.respondWithRefreshedUser(w, r, user.ID, "DawarichSettings")
}

func (h *DawarichHandlers) handleDeleteDawarichSettings(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r)
	if user == nil {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}

	h.dawarichSync.cancelUserSync(user.ID)

	if err := h.db.updateDawarichAPIKey(r.Context(), user.ID, nil); err != nil {
		log.Printf("[Dawarich] Failed to clear settings: %v", err)
		writeError(w, http.StatusInternalServerError, "failed to clear settings")
		return
	}

	if err := h.db.deleteDawarichData(r.Context(), user.ID); err != nil {
		log.Printf("[Dawarich] Failed to delete data: %v", err)
	}

	h.respondWithRefreshedUser(w, r, user.ID, "DeleteDawarichSettings")
}

func (h *DawarichHandlers) handleDawarichTracks(w http.ResponseWriter, r *http.Request) {
	user, ok := h.requireDawarichUser(w, r)
	if !ok {
		return
	}

	dbTracks, err := h.db.getDawarichTracks(r.Context(), user.ID)
	if err != nil {
		log.Printf("[Dawarich] Failed to query tracks for user %s: %v", user.ID, err)
		writeError(w, http.StatusInternalServerError, "failed to load tracks")
		return
	}

	tracks := make([]DawarichTrackListItem, 0, len(dbTracks))
	for _, t := range dbTracks {
		tracks = append(tracks, t.toListItem())
	}

	writeJSON(w, http.StatusOK, tracks)
}

func (h *DawarichHandlers) handleDawarichPreview(w http.ResponseWriter, r *http.Request) {
	user, ok := h.requireDawarichUser(w, r)
	if !ok {
		return
	}

	var req DawarichPreviewRequest
	if !decodeRequestBody(w, r, &req, "trackIDs is required") {
		return
	}

	maxGapSeconds := req.MaxGapSeconds
	if maxGapSeconds <= 0 {
		maxGapSeconds = defaultMaxGapSeconds
	}

	finder, err := getTimezoneFinder()
	if err != nil {
		log.Printf("[Dawarich] Failed to init timezone finder: %v", err)
		writeError(w, http.StatusInternalServerError, "failed to initialize timezone lookup")
		return
	}

	pointsByTrack, err := h.db.getDawarichTrackPoints(r.Context(), user.ID, req.TrackIDs)
	if err != nil {
		log.Printf("[Dawarich] Failed to load track points for user %s: %v", user.ID, err)
		writeError(w, http.StatusInternalServerError, "failed to load track points")
		return
	}

	results := make([]GPXPreviewResponse, 0)

	for _, trackID := range req.TrackIDs {
		dbPoints := pointsByTrack[trackID]
		if len(dbPoints) < 2 {
			continue
		}

		points := make([]trackPoint, 0, len(dbPoints))
		for _, p := range dbPoints {
			points = append(points, trackPoint{
				latitude:  p.Latitude,
				longitude: p.Longitude,
				elevation: float64(p.Altitude),
				time:      time.Unix(int64(p.Timestamp), 0).UTC(),
			})
		}

		midIdx := len(points) / 2
		trackTimezone := resolveTimezone(finder, points[midIdx].longitude, points[midIdx].latitude, h.defaultTimezone)

		trackStart := points[0].time
		trackEnd := points[len(points)-1].time
		tzPadding := 15 * time.Hour
		timeStart := trackStart.Add(-time.Duration(maxGapSeconds)*time.Second - tzPadding).Format(time.RFC3339)
		timeEnd := trackEnd.Add(time.Duration(maxGapSeconds)*time.Second + tzPadding).Format(time.RFC3339)

		assets, err := h.db.getAssetsWithTimestamps(r.Context(), user.ID, true, timeStart, timeEnd)
		if err != nil {
			log.Printf("[Dawarich] Failed to query assets for track %d: %v", trackID, err)
			writeError(w, http.StatusInternalServerError, "failed to query assets")
			return
		}

		matches := matchAssetsToTrack(assets, points, maxGapSeconds, trackTimezone)
		trackName := fmt.Sprintf("Track %d", trackID)
		summary := buildTrackSummary(trackName, points, maxTrackSummaryPoints)

		results = append(results, GPXPreviewResponse{
			Track:            summary,
			Matches:          matches,
			DetectedTimezone: trackTimezone.String(),
		})
	}

	writeJSON(w, http.StatusOK, results)
}

func (h *DawarichHandlers) handleDawarichSyncStatus(w http.ResponseWriter, r *http.Request) {
	user, ok := h.requireDawarichUser(w, r)
	if !ok {
		return
	}

	syncing := h.dawarichSync.isUserSyncing(user.ID)

	lastSyncAt, _ := h.db.getSyncState(r.Context(), user.ID, "lastDawarichSyncAt")
	lastSyncError, _ := h.db.getSyncState(r.Context(), user.ID, "lastDawarichSyncError")

	resp := DawarichSyncStatusResponse{
		Syncing:       syncing,
		LastSyncAt:    lastSyncAt,
		LastSyncError: lastSyncError,
	}

	if progress, ok := h.dawarichSync.getProgress(user.ID); ok {
		resp.CurrentTrack = &progress.currentTrack
		resp.TotalTracks = &progress.totalTracks
	}

	writeJSON(w, http.StatusOK, resp)
}

func (h *DawarichHandlers) handleDawarichTriggerSync(w http.ResponseWriter, r *http.Request) {
	user, ok := h.requireDawarichUser(w, r)
	if !ok {
		return
	}

	status, _ := h.dawarichSync.triggerUserSync(user.ID, *user.DawarichAPIKey)
	writeJSON(w, http.StatusOK, map[string]string{"status": status})
}
