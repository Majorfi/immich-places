package main

import (
	"fmt"
	"net/http"
)

func (h *Handlers) handleGetFolders(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r)
	if user == nil {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}

	tagID := r.URL.Query().Get("tagID")
	withGPS := r.URL.Query().Get("gpsFilter") == "with-gps"
	hiddenFilter := r.URL.Query().Get("hiddenFilter")
	if hiddenFilter == "" {
		hiddenFilter = hiddenFilterVisible
	}
	if hiddenFilter != hiddenFilterVisible && hiddenFilter != hiddenFilterHidden && hiddenFilter != hiddenFilterAll {
		writeError(w, http.StatusBadRequest, "hiddenFilter must be one of: visible, hidden, all")
		return
	}

	startDate, endDate, err := parseDateRangeParams(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	tree, err := h.db.getFolderTree(r.Context(), user.ID, withGPS, hiddenFilter, tagID, startDate, endDate)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load folders")
		return
	}

	writeJSON(w, http.StatusOK, tree)
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
	withGPS := r.URL.Query().Get("gpsFilter") == "with-gps"
	hiddenFilter := r.URL.Query().Get("hiddenFilter")
	if hiddenFilter == "" {
		hiddenFilter = hiddenFilterVisible
	}
	if hiddenFilter != hiddenFilterVisible && hiddenFilter != hiddenFilterHidden && hiddenFilter != hiddenFilterAll {
		writeError(w, http.StatusBadRequest, "hiddenFilter must be one of: visible, hidden, all")
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

	assets, total, err := h.db.getFolderAssets(r.Context(), user.ID, folderPath, withGPS, hiddenFilter, tagID, startDate, endDate, page, pageSize)
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
