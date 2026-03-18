package main

import (
	"context"
	"net/http"
)

type SyncStore interface {
	getSyncState(ctx context.Context, userID, key string) (*string, error)
	setSyncState(ctx context.Context, userID, key, value string) error
	deleteSyncState(ctx context.Context, userID, key string)
	upsertAssets(ctx context.Context, userID string, assets []AssetRow) error
	batchUpdateStackInfo(ctx context.Context, userID string, updates []stackUpdateRow) (int, error)
	computeFrequentLocationClusters(ctx context.Context, userID string) ([]FrequentLocationRow, error)
	replaceFrequentLocations(ctx context.Context, userID string, locations []FrequentLocationRow) error
	getAlbumUpdatedAtMap(ctx context.Context, userID string) (map[string]string, error)
	upsertAlbum(ctx context.Context, userID, albumID, albumName string, thumbnailAssetID *string, assetCount int, updatedAt string, startDate *string) error
	replaceAlbumAssets(ctx context.Context, userID, albumID string, assetIDs []string) error
	deleteAlbumsNotIn(ctx context.Context, userID string, albumIDs []string) error
	deleteAssetsNotIn(ctx context.Context, userID string, assetIDs []string) error
	upsertLibrary(ctx context.Context, libraryID, name string, assetCount int) error
	deleteLibrariesNotIn(ctx context.Context, libraryIDs []string) error
	needsLibraryIDBackfill(ctx context.Context, userID string) (bool, error)
}

type HandlerStore interface {
	getSyncState(ctx context.Context, userID, key string) (*string, error)
	countAssets(ctx context.Context, userID string) (int, error)
	countNoGPSAssets(ctx context.Context, userID string) (int, error)
	getFilteredAssets(ctx context.Context, userID, albumID string, withGPS bool, hiddenFilter string, page, pageSize int) ([]AssetRow, error)
	countFilteredAssets(ctx context.Context, userID, albumID string, withGPS bool, hiddenFilter string) (int, error)
	updateAssetHidden(ctx context.Context, userID, immichID string, isHidden bool) error
	bulkUpdateAssetHidden(ctx context.Context, userID string, immichIDs []string, isHidden bool) error
	getMapMarkers(ctx context.Context, userID, albumID string, bounds *TViewportBounds, limit int) ([]MapMarker, error)
	getAssetStackID(ctx context.Context, userID, immichID string) (*string, error)
	getStackMemberIDs(ctx context.Context, userID, stackID string) ([]string, error)
	bulkUpdateAssetLocation(ctx context.Context, userID string, immichIDs []string, lat, lon float64) error
	getFrequentLocations(ctx context.Context, userID string, limit int) ([]FrequentLocationRow, error)
	getAssetPageInfo(ctx context.Context, userID, assetID string, albumID string, pageSize int) (*AssetPageInfo, error)
	getAssetByID(ctx context.Context, userID, immichID string) (*AssetRow, error)
	getAlbumsWithNoGPSCount(ctx context.Context, userID string) ([]AlbumRow, error)
	getAlbumsWithGPSCount(ctx context.Context, userID string) ([]AlbumRow, error)
	getAssetsWithTimestamps(ctx context.Context, userID string, includeGeotagged bool, timeStart, timeEnd string) ([]AssetRow, error)
	getFavoritePlaces(ctx context.Context, userID string) ([]FavoritePlaceRow, error)
	addFavoritePlace(ctx context.Context, userID string, latitude, longitude float64, displayName string) error
	removeFavoritePlace(ctx context.Context, userID string, latitude, longitude float64) error
}

type SuggestionStore interface {
	getAssetByID(ctx context.Context, userID, immichID string) (*AssetRow, error)
	getSameDayAssets(ctx context.Context, userID, dateTimeOriginal string, hoursRange int) ([]AssetRow, error)
	getFrequentLocations(ctx context.Context, userID string, limit int) ([]FrequentLocationRow, error)
	getAlbumUpdatedAt(ctx context.Context, userID, albumID string) (string, error)
	getGeolocatedAssetsByAlbum(ctx context.Context, userID, albumID string) ([]AssetRow, error)
}

type HandlerImmichAPI interface {
	bulkUpdateLocation(ctx context.Context, ids []string, lat, lon float64) error
	getThumbnail(ctx context.Context, assetID string) (*http.Response, error)
	getPreview(ctx context.Context, assetID string) (*http.Response, error)
}

type SyncImmichAPI interface {
	searchAssets(ctx context.Context, page int, pageSize int, updatedAfter *string) (*ImmichSearchResponse, error)
	getStacks(ctx context.Context) ([]ImmichStackResponse, error)
	getAlbums(ctx context.Context) ([]ImmichAlbumResponse, error)
	getAlbumAssetIDs(ctx context.Context, albumID string) ([]string, error)
	getLibraries(ctx context.Context) ([]ImmichLibraryResponse, error)
}

type HandlerLibraryStore interface {
	getSyncState(ctx context.Context, userID, key string) (*string, error)
	getLibraries(ctx context.Context) ([]LibraryRow, error)
	updateLibraryVisibility(ctx context.Context, libraryID string, isHidden bool) error
}
