package main

import (
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"
)

type LibraryHandlers struct {
	db            HandlerLibraryStore
	immichFactory *ImmichClientFactory
	syncService   *SyncService
}

func newLibraryHandlers(db HandlerLibraryStore, immichFactory *ImmichClientFactory, syncService *SyncService) *LibraryHandlers {
	return &LibraryHandlers{
		db:            db,
		immichFactory: immichFactory,
		syncService:   syncService,
	}
}

func (h *LibraryHandlers) hasLibraryAccess(ctx context.Context, userID string) bool {
	hasAccess, err := h.db.getSyncState(ctx, userID, "hasLibraryAccess")
	if err != nil {
		log.Printf("[API] Library access check failed for user %s: %v", userID, err)
	}
	return hasAccess != nil && *hasAccess == "true"
}

func (h *LibraryHandlers) handleGetLibraries(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r)
	if user == nil {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}
	if !h.hasLibraryAccess(r.Context(), user.ID) {
		writeError(w, http.StatusForbidden, "library management requires admin access")
		return
	}

	libraries, err := h.db.getLibraries(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to query libraries")
		return
	}

	if libraries == nil {
		libraries = []LibraryRow{}
	}

	writeJSON(w, http.StatusOK, libraries)
}

func (h *LibraryHandlers) handleUpdateLibrary(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r)
	if user == nil {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}
	if !h.hasLibraryAccess(r.Context(), user.ID) {
		writeError(w, http.StatusForbidden, "library management requires admin access")
		return
	}

	libraryID := r.PathValue("libraryID")
	if libraryID == "" {
		writeError(w, http.StatusBadRequest, "missing library ID")
		return
	}

	var req LibraryUpdateRequest
	decoder := json.NewDecoder(io.LimitReader(r.Body, 1024))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.IsHidden == nil {
		writeError(w, http.StatusBadRequest, "isHidden is required")
		return
	}

	err := h.db.updateLibraryVisibility(r.Context(), libraryID, *req.IsHidden)
	if err != nil {
		if err.Error() == "library not found" {
			writeError(w, http.StatusNotFound, "library not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to update library")
		return
	}

	h.syncService.recomputeFrequentLocations(context.Background(), user.ID)
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *LibraryHandlers) handleRefreshLibraries(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r)
	if user == nil {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}
	if user.ImmichAPIKey == nil {
		writeError(w, http.StatusForbidden, "no Immich API key configured")
		return
	}

	immich := h.immichFactory.forUser(*user.ImmichAPIKey)
	if err := h.syncService.syncLibraries(r.Context(), user.ID, immich); err != nil {
		writeError(w, http.StatusBadGateway, "failed to refresh libraries from Immich")
		return
	}

	libraries, err := h.db.getLibraries(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to query libraries")
		return
	}

	if libraries == nil {
		libraries = []LibraryRow{}
	}

	writeJSON(w, http.StatusOK, libraries)
}
