package main

type DawarichTrackFeature struct {
	Type       string                         `json:"type"`
	Properties DawarichTrackFeatureProperties `json:"properties"`
}

type DawarichTrackFeatureProperties struct {
	ID         int     `json:"id"`
	Name       string  `json:"name"`
	StartedAt  string  `json:"started_at"`
	FinishedAt string  `json:"finished_at"`
	Distance   float64 `json:"distance"`
	Duration   int     `json:"duration"`
}

type DawarichFeatureCollection struct {
	Type     string                 `json:"type"`
	Features []DawarichTrackFeature `json:"features"`
}

type DawarichTrackListItem struct {
	ID         int     `json:"ID"`
	Name       string  `json:"name"`
	StartedAt  string  `json:"startedAt"`
	FinishedAt string  `json:"finishedAt"`
	Distance   float64 `json:"distance"`
	Duration   int     `json:"duration"`
	SyncedAt   *string `json:"syncedAt,omitempty"`
}

type DawarichPoint struct {
	Timestamp int    `json:"timestamp"`
	Latitude  string `json:"latitude"`
	Longitude string `json:"longitude"`
	Altitude  int    `json:"altitude"`
}

type DawarichPreviewRequest struct {
	TrackIDs      []int `json:"trackIDs" validate:"required,min=1"`
	MaxGapSeconds int   `json:"maxGapSeconds"`
}

type DawarichSettingsRequest struct {
	APIKey string `json:"apiKey" validate:"required"`
}

type DawarichTrackRow struct {
	ID         int
	Name       string
	StartedAt  string
	FinishedAt string
	Distance   float64
	Duration   int
	SyncedAt   string
}

func (r DawarichTrackRow) toListItem() DawarichTrackListItem {
	return DawarichTrackListItem{
		ID:         r.ID,
		Name:       r.Name,
		StartedAt:  r.StartedAt,
		FinishedAt: r.FinishedAt,
		Distance:   r.Distance,
		Duration:   r.Duration,
		SyncedAt:   &r.SyncedAt,
	}
}

func (item DawarichTrackListItem) toRow() DawarichTrackRow {
	return DawarichTrackRow{
		ID:         item.ID,
		Name:       item.Name,
		StartedAt:  item.StartedAt,
		FinishedAt: item.FinishedAt,
		Distance:   item.Distance,
		Duration:   item.Duration,
	}
}

type DawarichTrackPointRow struct {
	TrackID   int
	Timestamp int
	Latitude  float64
	Longitude float64
	Altitude  int
}

type DawarichSyncStatusResponse struct {
	Syncing       bool    `json:"syncing"`
	LastSyncAt    *string `json:"lastSyncAt"`
	LastSyncError *string `json:"lastSyncError"`
	CurrentTrack  *int    `json:"currentTrack"`
	TotalTracks   *int    `json:"totalTracks"`
}
