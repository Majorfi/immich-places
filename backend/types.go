package main

type AssetRow struct {
	ImmichID            string   `json:"immichID"`
	Type                string   `json:"type"`
	OriginalFileName    string   `json:"originalFileName"`
	FileCreatedAt       string   `json:"fileCreatedAt"`
	Latitude            *float64 `json:"latitude"`
	Longitude           *float64 `json:"longitude"`
	City                *string  `json:"city"`
	State               *string  `json:"state"`
	Country             *string  `json:"country"`
	DateTimeOriginal    *string  `json:"dateTimeOriginal"`
	SyncedAt            string   `json:"syncedAt"`
	StackID             *string  `json:"stackID,omitempty"`
	StackPrimaryAssetID *string  `json:"stackPrimaryAssetID,omitempty"`
	StackAssetCount     *int     `json:"stackAssetCount,omitempty"`
	LibraryID           *string  `json:"libraryID,omitempty"`
	IsHidden            bool     `json:"isHidden"`
}

type FrequentLocationRow struct {
	Latitude   float64 `json:"latitude"`
	Longitude  float64 `json:"longitude"`
	Label      string  `json:"label"`
	AssetCount int     `json:"assetCount"`
}

type PaginatedAssets struct {
	Items       []AssetRow `json:"items"`
	Total       int        `json:"total"`
	Page        int        `json:"page"`
	PageSize    int        `json:"pageSize"`
	HasNextPage bool       `json:"hasNextPage"`
}

type MapMarker struct {
	ImmichID  string  `json:"immichID"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}

type LocationCluster struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Label     string  `json:"label"`
	Count     int     `json:"count"`
}

type SuggestionsResponse struct {
	SameDayClusters   []LocationCluster `json:"sameDayClusters"`
	TwoDayClusters    []LocationCluster `json:"twoDayClusters"`
	WeeklyClusters    []LocationCluster `json:"weeklyClusters"`
	FrequentLocations []LocationCluster `json:"frequentLocations"`
	AlbumClusters     []LocationCluster `json:"albumClusters"`
}

type HealthResponse struct {
	Status       string  `json:"status"`
	SyncedAssets int     `json:"syncedAssets"`
	NoGPSAssets  int     `json:"noGPSAssets"`
	LastSyncAt   *string `json:"lastSyncAt"`
	ImmichURL    string  `json:"immichURL"`
	SyncVersion  int     `json:"syncVersion"`
}

type SyncStatusResponse struct {
	Syncing       bool    `json:"syncing"`
	LastSyncAt    *string `json:"lastSyncAt"`
	LastSyncError *string `json:"lastSyncError"`
}

type HiddenUpdateRequest struct {
	IsHidden *bool `json:"isHidden"`
}

type BulkHiddenUpdateRequest struct {
	AssetIDs []string `json:"assetIDs" validate:"required,min=1"`
	IsHidden *bool    `json:"isHidden"`
}

type LocationUpdateRequest struct {
	Latitude  *float64 `json:"latitude" validate:"required,min=-90,max=90"`
	Longitude *float64 `json:"longitude" validate:"required,min=-180,max=180"`
}

type TViewportBoundsRequest struct {
	North float64 `validate:"min=-90,max=90"`
	South float64 `validate:"min=-90,max=90,ltefield=North"`
	East  float64
	West  float64
}

type ImmichExifInfo struct {
	Latitude         *float64 `json:"latitude"`
	Longitude        *float64 `json:"longitude"`
	City             *string  `json:"city"`
	State            *string  `json:"state"`
	Country          *string  `json:"country"`
	DateTimeOriginal *string  `json:"dateTimeOriginal"`
}

type ImmichAssetResponse struct {
	ID               string          `json:"id"`
	Type             string          `json:"type"`
	OriginalFileName string          `json:"originalFileName"`
	FileCreatedAt    string          `json:"fileCreatedAt"`
	ExifInfo         *ImmichExifInfo `json:"exifInfo"`
	LibraryID        *string         `json:"libraryId"`
}

type ImmichStackResponse struct {
	ID             string `json:"id"`
	PrimaryAssetID string `json:"primaryAssetId"`
	Assets         []struct {
		ID string `json:"id"`
	} `json:"assets"`
}

type ImmichSearchResponse struct {
	Assets struct {
		Items    []ImmichAssetResponse `json:"items"`
		NextPage *string               `json:"nextPage"`
	} `json:"assets"`
}

type AlbumRow struct {
	ImmichID         string  `json:"immichID"`
	AlbumName        string  `json:"albumName"`
	ThumbnailAssetID *string `json:"thumbnailAssetID"`
	AssetCount       int     `json:"assetCount"`
	FilteredCount    int     `json:"filteredCount"`
	NoGPSCount       int     `json:"noGPSCount"`
	UpdatedAt        string  `json:"updatedAt"`
	StartDate        *string `json:"startDate"`
}

type ImmichAlbumResponse struct {
	ID                    string  `json:"id"`
	AlbumName             string  `json:"albumName"`
	AlbumThumbnailAssetID *string `json:"albumThumbnailAssetId"`
	AssetCount            int     `json:"assetCount"`
	UpdatedAt             string  `json:"updatedAt"`
	StartDate             *string `json:"startDate"`
}

type ImmichAlbumDetailResponse struct {
	Assets []struct {
		ID string `json:"id"`
	} `json:"assets"`
}

type AssetPageInfo struct {
	Page    int     `json:"page"`
	AlbumID *string `json:"albumID"`
}

type TViewportBounds struct {
	North float64
	South float64
	East  float64
	West  float64
}

type UserRow struct {
	ID           string  `json:"ID"`
	Email        string  `json:"email"`
	PasswordHash string  `json:"-"`
	ImmichAPIKey *string `json:"-"`
	CreatedAt    string  `json:"createdAt"`
	UpdatedAt    string  `json:"updatedAt"`
}

type RegisterRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=8"`
}

type LoginRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

type UpdateAPIKeyRequest struct {
	ImmichAPIKey *string `json:"immichAPIKey"`
}

type TMeResponse struct {
	User            UserRow `json:"user"`
	HasImmichAPIKey bool    `json:"hasImmichAPIKey"`
	HasLibraries    bool    `json:"hasLibraries"`
	MapMarkerCount  int     `json:"mapMarkerCount"`
}

type AuthStatusResponse struct {
	RegistrationEnabled bool `json:"registrationEnabled"`
}

type LibraryRow struct {
	LibraryID  string `json:"libraryID"`
	Name       string `json:"name"`
	AssetCount int    `json:"assetCount"`
	IsHidden   bool   `json:"isHidden"`
	SyncedAt   string `json:"syncedAt"`
}

type ImmichLibraryResponse struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	AssetCount int    `json:"assetCount"`
}

type LibraryUpdateRequest struct {
	IsHidden *bool `json:"isHidden" validate:"required"`
}

type FavoritePlaceRow struct {
	ID          int     `json:"ID"`
	Latitude    float64 `json:"latitude"`
	Longitude   float64 `json:"longitude"`
	DisplayName string  `json:"displayName"`
	CreatedAt   string  `json:"createdAt"`
}

type AddFavoritePlaceRequest struct {
	Latitude    *float64 `json:"latitude" validate:"required,min=-90,max=90"`
	Longitude   *float64 `json:"longitude" validate:"required,min=-180,max=180"`
	DisplayName string   `json:"displayName" validate:"required"`
}

type RemoveFavoritePlaceRequest struct {
	Latitude  *float64 `json:"latitude" validate:"required,min=-90,max=90"`
	Longitude *float64 `json:"longitude" validate:"required,min=-180,max=180"`
}

type GPXTrackPoint struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}

type GPXTrackSummary struct {
	Name       string          `json:"name"`
	Points     []GPXTrackPoint `json:"points"`
	StartTime  string          `json:"startTime"`
	EndTime    string          `json:"endTime"`
	PointCount int             `json:"pointCount"`
}

type GPXMatchResult struct {
	AssetID          string  `json:"assetID"`
	FileName         string  `json:"fileName"`
	Latitude         float64 `json:"latitude"`
	Longitude        float64 `json:"longitude"`
	Elevation        float64 `json:"elevation"`
	TimeGap          int     `json:"timeGap"`
	IsAlreadyApplied bool    `json:"isAlreadyApplied"`
}

type GPXPreviewResponse struct {
	Track            GPXTrackSummary  `json:"track"`
	Matches          []GPXMatchResult `json:"matches"`
	DetectedTimezone string           `json:"detectedTimezone"`
}

