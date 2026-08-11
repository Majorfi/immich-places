package main

import "net/http"

// handleGetMissingLocationCount reports how many assets lack coordinates under the
// album, tag, hidden and date filters currently active in the UI. The GPS filter is
// deliberately not read from the query: the badge always answers "how many photos
// would the Missing location filter show", whichever filter is selected right now.
func (h *Handlers) handleGetMissingLocationCount(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r)
	if user == nil {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}

	albumID := r.URL.Query().Get("albumID")
	tagID := r.URL.Query().Get("tagID")
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

	count, err := h.db.countFilteredAssets(r.Context(), user.ID, albumID, tagID, gpsFilterNoGPS, hiddenFilter, startDate, endDate)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to count assets missing location")
		return
	}

	writeJSON(w, http.StatusOK, MissingLocationCount{Count: count})
}
