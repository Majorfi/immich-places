'use client';

import {useMemo} from 'react';

import type {
	TBackendContextValue,
	TCatalogContextValue,
	TMapSceneValue,
	TSelectionContextValue,
	TUIMapContextValue,
	TViewContextValue
} from '@/shared/types/context';

/**
 * Memoizes and normalizes backend context values for stable provider references.

 * @param input - Raw backend state and actions.
 * @returns Memoized backend context value.
 */
export function useBackendValue(input: TBackendContextValue): TBackendContextValue {
	return useMemo<TBackendContextValue>(
		() => ({
			isReady: input.isReady,
			health: input.health,
			backendError: input.backendError,
			retryBackendAction: input.retryBackendAction,
			isSyncing: input.isSyncing,
			syncError: input.syncError,
			resyncAction: input.resyncAction,
			refreshDataAction: input.refreshDataAction,
			clearCatalogAction: input.clearCatalogAction
		}),
		[
			input.isReady,
			input.health,
			input.backendError,
			input.retryBackendAction,
			input.isSyncing,
			input.syncError,
			input.resyncAction,
			input.refreshDataAction,
			input.clearCatalogAction
		]
	);
}

/** Memoizes and normalizes view context values for stable provider references. */
export function useViewValue(input: TViewContextValue): TViewContextValue {
	return useMemo<TViewContextValue>(
		() => ({
			gpsFilter: input.gpsFilter,
			setGPSFilterAction: input.setGPSFilterAction,
			pageSize: input.pageSize,
			setPageSizeAction: input.setPageSizeAction,
			gridColumns: input.gridColumns,
			setGridColumnsAction: input.setGridColumnsAction,
			visibleMarkerLimit: input.visibleMarkerLimit,
			setVisibleMarkerLimitAction: input.setVisibleMarkerLimitAction,
			viewMode: input.viewMode,
			setViewModeAction: input.setViewModeAction,
			selectedAlbumID: input.selectedAlbumID,
			selectAlbumAction: input.selectAlbumAction
		}),
		[
			input.gpsFilter,
			input.setGPSFilterAction,
			input.pageSize,
			input.setPageSizeAction,
			input.gridColumns,
			input.setGridColumnsAction,
			input.visibleMarkerLimit,
			input.setVisibleMarkerLimitAction,
			input.viewMode,
			input.setViewModeAction,
			input.selectedAlbumID,
			input.selectAlbumAction
		]
	);
}

/** Memoizes and normalizes catalog context values for stable provider references. */
export function useCatalogValue(input: TCatalogContextValue): TCatalogContextValue {
	return useMemo<TCatalogContextValue>(
		() => ({
			albums: input.albums,
			isLoadingAlbums: input.isLoadingAlbums,
			albumsError: input.albumsError,
			loadAlbumsAction: input.loadAlbumsAction,
			assets: input.assets,
			total: input.total,
			currentPage: input.currentPage,
			isLoadingAssets: input.isLoadingAssets,
			assetsError: input.assetsError,
			loadPageAction: input.loadPageAction,
			suggestions: input.suggestions,
			categories: input.categories,
			suggestionsError: input.suggestionsError,
			selectedAlbum: input.selectedAlbum
		}),
		[
			input.albums,
			input.isLoadingAlbums,
			input.albumsError,
			input.loadAlbumsAction,
			input.assets,
			input.total,
			input.currentPage,
			input.isLoadingAssets,
			input.assetsError,
			input.loadPageAction,
			input.suggestions,
			input.categories,
			input.suggestionsError,
			input.selectedAlbum
		]
	);
}

/** Memoizes and normalizes selection context values for stable provider references. */
export function useSelectionValue(input: TSelectionContextValue): TSelectionContextValue {
	return useMemo<TSelectionContextValue>(
		() => ({
			selectedAssets: input.selectedAssets,
			pendingLocation: input.pendingLocation,
			pendingLocationsByAssetID: input.pendingLocationsByAssetID,
			savedLocationsByAssetID: input.savedLocationsByAssetID,
			clearSavedLocationsAction: input.clearSavedLocationsAction,
			isSaving: input.isSaving,
			saveError: input.saveError,
			toggleAssetAction: input.toggleAssetAction,
			shiftSelectAction: input.shiftSelectAction,
			selectAllAction: input.selectAllAction,
			clearSelectionAction: input.clearSelectionAction,
			setLocationAction: input.setLocationAction,
			clearLocationAction: input.clearLocationAction,
			saveAction: input.saveAction
		}),
		[
			input.selectedAssets,
			input.pendingLocation,
			input.pendingLocationsByAssetID,
			input.savedLocationsByAssetID,
			input.isSaving,
			input.clearSavedLocationsAction,
			input.saveError,
			input.toggleAssetAction,
			input.shiftSelectAction,
			input.selectAllAction,
			input.clearSelectionAction,
			input.setLocationAction,
			input.clearLocationAction,
			input.saveAction
		]
	);
}

/** Memoizes and normalizes UI map context values for stable provider references. */
export function useUIMapValue(input: TUIMapContextValue): TUIMapContextValue {
	return useMemo<TUIMapContextValue>(
		() => ({
			focusedAssetID: input.focusedAssetID,
			clearFocusedAssetAction: input.clearFocusedAssetAction,
			focusMapAssetAction: input.focusMapAssetAction,
			lightboxAssetID: input.lightboxAssetID,
			openLightboxAction: input.openLightboxAction,
			closeLightboxAction: input.closeLightboxAction,
			mapMarkersVersion: input.mapMarkersVersion
		}),
		[
			input.focusedAssetID,
			input.clearFocusedAssetAction,
			input.focusMapAssetAction,
			input.lightboxAssetID,
			input.openLightboxAction,
			input.closeLightboxAction,
			input.mapMarkersVersion
		]
	);
}

/** Memoizes and normalizes map scene values for map consumers. */
export function useMapSceneValue(input: TMapSceneValue): TMapSceneValue {
	return useMemo<TMapSceneValue>(
		() => ({
			gpsFilter: input.gpsFilter,
			viewMode: input.viewMode,
			selectedAlbumID: input.selectedAlbumID,
			assets: input.assets,
			selectedAssets: input.selectedAssets,
			pendingLocation: input.pendingLocation,
			pendingLocationsByAssetID: input.pendingLocationsByAssetID,
			savedLocationsByAssetID: input.savedLocationsByAssetID,
			clearLocationAction: input.clearLocationAction,
			setLocationAction: input.setLocationAction,
			toggleAssetAction: input.toggleAssetAction,
			clearSelectionAction: input.clearSelectionAction,
			clearSavedLocationsAction: input.clearSavedLocationsAction,
			openLightboxAction: input.openLightboxAction,
			closeLightboxAction: input.closeLightboxAction,
			mapMarkersVersion: input.mapMarkersVersion
		}),
		[
			input.gpsFilter,
			input.viewMode,
			input.selectedAlbumID,
			input.assets,
			input.selectedAssets,
			input.pendingLocation,
			input.pendingLocationsByAssetID,
			input.savedLocationsByAssetID,
			input.setLocationAction,
			input.clearLocationAction,
			input.toggleAssetAction,
			input.clearSelectionAction,
			input.clearSavedLocationsAction,
			input.openLightboxAction,
			input.closeLightboxAction,
			input.mapMarkersVersion
		]
	);
}
