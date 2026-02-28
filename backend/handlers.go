package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"strconv"

	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
)

const (
	maxAssetsPageSize       = 120
	defaultAssetsPageSize   = 20
	maxPageInfoPageSize     = 500
	defaultPageInfoPageSize = 90
	frequentLocationsLimit  = 5
	maxClusterResults       = 5
)

var (
	validate              = validator.New()
	errImmichUpdateFailed = errors.New("immich update failed")
)

func isValidUUID(s string) bool {
	_, err := uuid.Parse(s)
	return err == nil
}

type Handlers struct {
	db                HandlerStore
	immichFactory     *ImmichClientFactory
	immichExternalURL string
	syncService       *SyncService
	suggestions       *SuggestionService
}

func parseAssetID(r *http.Request) (string, error) {
	assetID := r.PathValue("assetID")
	if assetID == "" {
		return "", errors.New("missing asset ID")
	}
	if !isValidUUID(assetID) {
		return "", errors.New("invalid asset ID format")
	}
	return assetID, nil
}

func proxyImmichImage(w http.ResponseWriter, resp *http.Response) {
	defer resp.Body.Close()
	w.Header().Set("Content-Type", resp.Header.Get("Content-Type"))
	w.Header().Set("Cache-Control", "private, max-age=86400")
	w.WriteHeader(resp.StatusCode)
	io.Copy(w, resp.Body)
}

func newHandlers(db HandlerStore, immichFactory *ImmichClientFactory, immichExternalURL string, syncService *SyncService, suggestions *SuggestionService) *Handlers {
	return &Handlers{
		db:                db,
		immichFactory:     immichFactory,
		immichExternalURL: immichExternalURL,
		syncService:       syncService,
		suggestions:       suggestions,
	}
}

func requireImmichClient(r *http.Request, factory *ImmichClientFactory) (*ImmichClient, *UserRow, error) {
	user := getUserFromContext(r)
	if user == nil {
		return nil, nil, fmt.Errorf("not authenticated")
	}
	if user.ImmichAPIKey == nil {
		return nil, nil, fmt.Errorf("no Immich API key configured")
	}
	return factory.forUser(*user.ImmichAPIKey), user, nil
}

func (h *Handlers) ensureAssetVisible(ctx context.Context, userID, assetID string) error {
	asset, err := h.db.getAssetByID(ctx, userID, assetID)
	if err != nil {
		return err
	}
	if asset == nil {
		return sql.ErrNoRows
	}
	return nil
}

func (h *Handlers) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, HealthResponse{
		Status:    "ok",
		ImmichURL: h.immichExternalURL,
	})
}

func (h *Handlers) handleGetAssets(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user := getUserFromContext(r)
	if user == nil {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}

	page, err := queryInt(r, "page", 1)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	pageSize, err := queryInt(r, "pageSize", defaultAssetsPageSize)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	albumID := r.URL.Query().Get("albumID")
	withGPS := r.URL.Query().Get("gpsFilter") == "with-gps"

	if page < 1 {
		writeError(w, http.StatusBadRequest, "page must be >= 1")
		return
	}
	if pageSize < 1 || pageSize > maxAssetsPageSize {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("pageSize must be between 1 and %d", maxAssetsPageSize))
		return
	}

	assets, err := h.db.getFilteredAssets(ctx, user.ID, albumID, withGPS, page, pageSize)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to query assets")
		return
	}

	total, err := h.db.countFilteredAssets(ctx, user.ID, albumID, withGPS)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to count assets")
		return
	}

	if assets == nil {
		assets = []AssetRow{}
	}

	writeJSON(w, http.StatusOK, PaginatedAssets{
		Items:       assets,
		Total:       total,
		Page:        page,
		PageSize:    pageSize,
		HasNextPage: page*pageSize < total,
	})
}

func (h *Handlers) handleGetAlbums(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user := getUserFromContext(r)
	if user == nil {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}
	gpsFilter := r.URL.Query().Get("gpsFilter")

	var albums []AlbumRow
	var err error

	if gpsFilter == "with-gps" {
		albums, err = h.db.getAlbumsWithGPSCount(ctx, user.ID)
	} else {
		albums, err = h.db.getAlbumsWithNoGPSCount(ctx, user.ID)
	}

	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to query albums")
		return
	}

	if albums == nil {
		albums = []AlbumRow{}
	}

	writeJSON(w, http.StatusOK, albums)
}

func (h *Handlers) handleGetMapMarkers(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user := getUserFromContext(r)
	if user == nil {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}
	albumID := r.URL.Query().Get("albumID")

	var bounds *TViewportBounds
	q := r.URL.Query()
	northStr, southStr, eastStr, westStr := q.Get("north"), q.Get("south"), q.Get("east"), q.Get("west")
	hasBounds := northStr != "" || southStr != "" || eastStr != "" || westStr != ""
	if hasBounds {
		if northStr == "" || southStr == "" || eastStr == "" || westStr == "" {
			writeError(w, http.StatusBadRequest, "all four bounds (north, south, east, west) are required")
			return
		}
		n, errN := strconv.ParseFloat(northStr, 64)
		s, errS := strconv.ParseFloat(southStr, 64)
		e, errE := strconv.ParseFloat(eastStr, 64)
		w2, errW := strconv.ParseFloat(westStr, 64)
		if errN != nil || errS != nil || errE != nil || errW != nil {
			writeError(w, http.StatusBadRequest, "bounds must be valid numbers")
			return
		}
		if math.IsNaN(n) || math.IsNaN(s) || math.IsNaN(e) || math.IsNaN(w2) || math.IsInf(n, 0) || math.IsInf(s, 0) || math.IsInf(e, 0) || math.IsInf(w2, 0) {
			writeError(w, http.StatusBadRequest, "bounds must be valid finite numbers")
			return
		}
		boundsReq := TViewportBoundsRequest{North: n, South: s, East: e, West: w2}
		if err := validate.Struct(boundsReq); err != nil {
			writeError(w, http.StatusBadRequest, "invalid bounds: latitude must be between -90 and 90, south must be <= north")
			return
		}
		bounds = &TViewportBounds{North: n, South: s, East: boundsReq.East, West: boundsReq.West}
	}

	markers, err := h.db.getMapMarkers(ctx, user.ID, albumID, bounds)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to query map markers")
		return
	}

	if markers == nil {
		markers = []MapMarker{}
	}

	writeJSON(w, http.StatusOK, markers)
}

func (h *Handlers) handleGetThumbnail(w http.ResponseWriter, r *http.Request) {
	assetID, err := parseAssetID(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	client, user, err := requireImmichClient(r, h.immichFactory)
	if err != nil {
		writeError(w, http.StatusForbidden, err.Error())
		return
	}
	if err := h.ensureAssetVisible(r.Context(), user.ID, assetID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "asset not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to query asset")
		return
	}

	resp, err := client.getThumbnail(r.Context(), assetID)
	if err != nil {
		writeError(w, http.StatusBadGateway, "failed to fetch thumbnail from Immich")
		return
	}
	proxyImmichImage(w, resp)
}

func (h *Handlers) handleGetPreview(w http.ResponseWriter, r *http.Request) {
	assetID, err := parseAssetID(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	client, user, err := requireImmichClient(r, h.immichFactory)
	if err != nil {
		writeError(w, http.StatusForbidden, err.Error())
		return
	}
	if err := h.ensureAssetVisible(r.Context(), user.ID, assetID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "asset not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to query asset")
		return
	}

	resp, err := client.getPreview(r.Context(), assetID)
	if err != nil {
		writeError(w, http.StatusBadGateway, "failed to fetch preview from Immich")
		return
	}
	proxyImmichImage(w, resp)
}

func (h *Handlers) handleUpdateLocation(w http.ResponseWriter, r *http.Request) {
	assetID, err := parseAssetID(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	var req LocationUpdateRequest
	decoder := json.NewDecoder(io.LimitReader(r.Body, 1024))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := validate.Struct(req); err != nil {
		writeError(w, http.StatusBadRequest, "latitude and longitude are required; latitude must be between -90 and 90, longitude between -180 and 180")
		return
	}

	client, user, clientErr := requireImmichClient(r, h.immichFactory)
	if clientErr != nil {
		writeError(w, http.StatusForbidden, clientErr.Error())
		return
	}
	if err := h.ensureAssetVisible(r.Context(), user.ID, assetID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "asset not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to query asset")
		return
	}

	err = h.resolveAndUpdateLocation(r.Context(), client, user.ID, assetID, *req.Latitude, *req.Longitude)
	if err != nil {
		log.Printf("Failed to update location for %s: %v", assetID, err)
		if errors.Is(err, errImmichUpdateFailed) {
			writeError(w, http.StatusBadGateway, "failed to update location in Immich")
		} else {
			writeError(w, http.StatusInternalServerError, "failed to update location")
		}
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handlers) resolveAndUpdateLocation(ctx context.Context, immich HandlerImmichAPI, userID, assetID string, lat, lon float64) error {
	allIDs := []string{assetID}

	stackID, err := h.db.getAssetStackID(ctx, userID, assetID)
	if err != nil {
		return fmt.Errorf("stack lookup for asset %s: %w", assetID, err)
	}
	if stackID != nil {
		memberIDs, err := h.db.getStackMemberIDs(ctx, userID, *stackID)
		if err != nil {
			return fmt.Errorf("stack member lookup for stack %s: %w", *stackID, err)
		}
		if len(memberIDs) > 0 {
			allIDs = memberIDs
		}
	}

	if err := immich.bulkUpdateLocation(ctx, allIDs, lat, lon); err != nil {
		return fmt.Errorf("%w: %v", errImmichUpdateFailed, err)
	}

	if err := h.db.bulkUpdateAssetLocation(ctx, userID, allIDs, lat, lon); err != nil {
		return fmt.Errorf("local persist failed: %w", err)
	}

	return nil
}

func (h *Handlers) handleGetSuggestions(w http.ResponseWriter, r *http.Request) {
	assetID, err := parseAssetID(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	user := getUserFromContext(r)
	if user == nil {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}

	albumID := r.URL.Query().Get("albumID")
	suggestions, err := h.suggestions.getSuggestions(r.Context(), user.ID, assetID, albumID)
	if err != nil {
		if errors.Is(err, errAssetNotFound) {
			writeError(w, http.StatusNotFound, "asset not found")
			return
		}
		log.Printf("Failed to get suggestions: %v", err)
		writeError(w, http.StatusInternalServerError, "failed to get suggestions")
		return
	}

	writeJSON(w, http.StatusOK, suggestions)
}

func (h *Handlers) handleGetFrequentLocations(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user := getUserFromContext(r)
	if user == nil {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}

	freqLocs, err := h.db.getFrequentLocations(ctx, user.ID, frequentLocationsLimit)
	if err != nil {
		log.Printf("Failed to get frequent locations: %v", err)
		writeError(w, http.StatusInternalServerError, "failed to get frequent locations")
		return
	}

	clusters := make([]LocationCluster, 0, len(freqLocs))
	for _, loc := range freqLocs {
		clusters = append(clusters, LocationCluster{
			Latitude:  loc.Latitude,
			Longitude: loc.Longitude,
			Label:     loc.Label,
			Count:     loc.AssetCount,
		})
	}

	writeJSON(w, http.StatusOK, clusters)
}

func (h *Handlers) handleGetAssetPageInfo(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user := getUserFromContext(r)
	if user == nil {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}

	assetID, err := parseAssetID(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	pageSize, err := queryInt(r, "pageSize", defaultPageInfoPageSize)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	albumID := r.URL.Query().Get("albumID")

	if pageSize < 1 || pageSize > maxPageInfoPageSize {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("pageSize must be between 1 and %d", maxPageInfoPageSize))
		return
	}

	info, err := h.db.getAssetPageInfo(ctx, user.ID, assetID, albumID, pageSize)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "asset not found")
		} else {
			log.Printf("Failed to get asset page info for %s: %v", assetID, err)
			writeError(w, http.StatusInternalServerError, "failed to get asset page info")
		}
		return
	}

	writeJSON(w, http.StatusOK, info)
}

func (h *Handlers) handleTriggerSync(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r)
	if user == nil || user.ImmichAPIKey == nil {
		writeError(w, http.StatusForbidden, "no Immich API key configured")
		return
	}

	reason, ok := h.syncService.triggerUserSync(user.ID, *user.ImmichAPIKey)
	if !ok {
		writeJSON(w, http.StatusOK, map[string]string{"status": reason})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": reason})
}

func (h *Handlers) handleSyncStatus(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user := getUserFromContext(r)
	if user == nil {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}

	lastSyncAt, _ := h.db.getSyncState(ctx, user.ID, "lastSyncAt")
	lastSyncError, _ := h.db.getSyncState(ctx, user.ID, "lastSyncError")

	writeJSON(w, http.StatusOK, SyncStatusResponse{
		Syncing:       h.syncService.isUserSyncing(user.ID),
		LastSyncAt:    lastSyncAt,
		LastSyncError: lastSyncError,
	})
}

func queryInt(r *http.Request, key string, defaultVal int) (int, error) {
	val := r.URL.Query().Get(key)
	if val == "" {
		return defaultVal, nil
	}
	parsed, err := strconv.Atoi(val)
	if err != nil {
		return 0, fmt.Errorf("invalid %s: must be an integer", key)
	}
	return parsed, nil
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}
