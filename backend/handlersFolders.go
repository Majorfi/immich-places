package main

import (
	"fmt"
	"net/http"
	"path"
)

func (h *Handlers) handleGetFolders(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r)
	if user == nil {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}

	tagID := r.URL.Query().Get("tagID")
	gpsFilter, err := parseGPSFilterParam(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	hiddenFilter, err := parseHiddenFilterParam(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	startDate, endDate, err := parseDateRangeParams(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	tree, err := h.db.getFolderTree(r.Context(), user.ID, gpsFilter, hiddenFilter, tagID, startDate, endDate)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load folders")
		return
	}

	writeJSON(w, http.StatusOK, tree)
}

// handleGetAssetFolder resolves the folder an asset lives in, so the map context menu
// can offer a jump into the Folders view. Map markers carry only an immichID, and
// putting originalPath on all of them would bloat a payload of up to maxMapMarkers.
func (h *Handlers) handleGetAssetFolder(w http.ResponseWriter, r *http.Request) {
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

	asset, err := h.db.getAssetByID(r.Context(), user.ID, assetID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load asset")
		return
	}
	if asset == nil {
		writeError(w, http.StatusNotFound, "asset not found")
		return
	}

	// Assets synced before the originalPath backfill have no path yet: report an empty
	// folder rather than a bogus ".", and let the client hide the menu entry.
	folder := ""
	if asset.OriginalPath != "" {
		dir := path.Dir(asset.OriginalPath)
		if dir != "." && dir != "/" {
			folder = dir
		}
	}

	writeJSON(w, http.StatusOK, AssetFolder{Path: folder})
}

func (h *Handlers) handleGetFolderAssets(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r)
	if user == nil {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}

	folderPath := r.URL.Query().Get("path")
	if folderPath == "" {
		writeError(w, http.StatusBadRequest, "path is required")
		return
	}

	tagID := r.URL.Query().Get("tagID")
	gpsFilter, err := parseGPSFilterParam(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	hiddenFilter, err := parseHiddenFilterParam(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	startDate, endDate, err := parseDateRangeParams(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
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
	if page < 1 {
		writeError(w, http.StatusBadRequest, "page must be >= 1")
		return
	}
	if pageSize < 1 || pageSize > maxAssetsPageSize {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("pageSize must be between 1 and %d", maxAssetsPageSize))
		return
	}

	assets, total, err := h.db.getFolderAssets(r.Context(), user.ID, folderPath, gpsFilter, hiddenFilter, tagID, startDate, endDate, page, pageSize)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to query folder assets")
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
