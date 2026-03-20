'use client';

import {useCallback, useEffect, useRef} from 'react';

import {useAuth} from '@/features/auth/AuthContext';
import {useSelectionCallbacks} from '@/features/selection/useSelectionCallbacks';
import {useSelectionController} from '@/features/selection/useSelectionController';
import {useCatalogSuggestions} from '@/features/suggestions/useCatalogSuggestions';
import {useCatalogDomain} from '@/shared/context/useCatalogDomain';
import {
	useBackendValue,
	useCatalogValue,
	useMapSceneValue,
	useSelectionValue,
	useUIMapValue,
	useViewValue
} from '@/shared/context/useProviderValues';
import {useUIMapController} from '@/shared/context/useUIMapController';
import {useViewDomain} from '@/shared/context/useViewDomain';
import {useBackendStatus} from '@/shared/hooks/useBackendStatus';
import {useResync} from '@/shared/hooks/useResync';

import type {
	TBackendContextValue,
	TCatalogContextValue,
	TMapSceneValue,
	TSelectionContextValue,
	TUIMapContextValue,
	TViewContextValue
} from '@/shared/types/context';

type TAppProviderState = {
	backendValue: TBackendContextValue;
	viewValue: TViewContextValue;
	catalogValue: TCatalogContextValue;
	selectionValue: TSelectionContextValue;
	uiMapValue: TUIMapContextValue;
	mapSceneValue: TMapSceneValue;
};

type TUseCatalogRefreshDataArgs = {
	loadAlbumsAction: () => Promise<void>;
	loadPageAction: (page: number) => Promise<void>;
	getCurrentPage: () => number;
	bumpMapMarkers: () => void;
	refreshUser: () => Promise<void>;
};

function useCatalogRefreshData({
	loadAlbumsAction,
	loadPageAction,
	getCurrentPage,
	bumpMapMarkers,
	refreshUser
}: TUseCatalogRefreshDataArgs): () => Promise<void> {
	const currentPageRef = useRef(getCurrentPage());
	useEffect(() => {
		currentPageRef.current = getCurrentPage();
	}, [getCurrentPage]);

	return useCallback(async () => {
		const currentPage = currentPageRef.current;
		await Promise.all([loadAlbumsAction(), loadPageAction(currentPage), refreshUser()]);
		bumpMapMarkers();
	}, [loadAlbumsAction, loadPageAction, refreshUser, bumpMapMarkers]);
}

export function useAppProviderState(): TAppProviderState {
	const {refreshUser} = useAuth();
	const {isReady, health, error: backendError, retry: retryBackendAction, refreshHealth} = useBackendStatus();

	const {
		gpsFilter,
		setGPSFilterRawAction,
		hiddenFilter,
		setHiddenFilterAction,
		pageSize,
		setPageSizeAction,
		gridColumns,
		setGridColumnsAction,
		visibleMarkerLimit,
		setVisibleMarkerLimitAction,
		viewMode,
		setViewModeAction,
		selectedAlbumID,
		startDate,
		endDate,
		setGPSFilterAction,
		selectAlbumAction,
		setDateRangeAction
	} = useViewDomain();

	const catalogDomain = useCatalogDomain({
		gpsFilter,
		hiddenFilter,
		pageSize,
		viewMode,
		selectedAlbumID,
		startDate,
		endDate,
		isReady
	});

	const {onAssetSavedAction, onBatchSavedAction} = useSelectionCallbacks({
		removeAsset: catalogDomain.removeAsset,
		refreshHealth,
		refreshUser,
		loadAlbumsAction: catalogDomain.loadAlbumsAction,
		loadPageAction: catalogDomain.loadPageAction,
		currentPage: catalogDomain.currentPage
	});

	const {
		selectedAssets,
		pendingLocation,
		pendingLocationsByAssetID,
		savedLocationsByAssetID,
		isSaving,
		saveError,
		toggleAssetAction,
		shiftSelectAction,
		selectAllAction,
		clearSelectionAction,
		clearSavedLocationsAction,
		setLocationAction,
		clearLocationAction,
		saveAction,
		undoLocationAction,
		redoLocationAction,
		canUndoLocation,
		canRedoLocation,
		beginLocationBatch,
		endLocationBatch,
		gpxStatusFilter,
		setGPXStatusFilterAction,
		mapMarkersVersion,
		bumpMapMarkers
	} = useSelectionController({onAssetSavedAction, onBatchSavedAction});

	const {
		focusedAssetID,
		clearFocusedAssetAction,
		focusMapAssetAction,
		lightboxAssetID,
		openLightboxAction,
		closeLightboxAction
	} = useUIMapController({
		gpsFilter,
		setGPSFilterRawAction,
		viewMode,
		selectedAlbumID,
		selectAlbumAction,
		pageSize,
		loadPageAction: catalogDomain.loadPageAction,
		selectedAssets,
		focusPageRef: catalogDomain.focusPageRef
	});

	const {suggestions, categories, suggestionsError, selectedAlbum} = useCatalogSuggestions({
		selectedAssets,
		viewMode,
		selectedAlbumID,
		albums: catalogDomain.albums
	});

	const {loadAlbumsAction, loadPageAction, clearCatalog: clearCatalogDomainAction} = catalogDomain;
	const getCurrentPage = useCallback(() => catalogDomain.currentPage, [catalogDomain.currentPage]);
	const refreshData = useCatalogRefreshData({
		loadAlbumsAction,
		loadPageAction,
		getCurrentPage,
		bumpMapMarkers,
		refreshUser
	});

	const {isSyncing, syncError, resyncAction, fullResyncAction} = useResync({
		isReady,
		syncVersion: health?.syncVersion ?? 0,
		retryBackendAction,
		refreshData,
		refreshAuthAction: refreshUser
	});

	const clearCatalogAction = useCallback(() => {
		clearCatalogDomainAction();
		clearSelectionAction();
	}, [clearCatalogDomainAction, clearSelectionAction]);

	const backendValue = useBackendValue({
		isReady,
		health,
		backendError,
		retryBackendAction,
		isSyncing,
		syncError,
		resyncAction,
		fullResyncAction,
		refreshDataAction: refreshData,
		clearCatalogAction
	});

	const viewValue = useViewValue({
		gpsFilter,
		setGPSFilterAction,
		hiddenFilter,
		setHiddenFilterAction,
		pageSize,
		setPageSizeAction,
		gridColumns,
		setGridColumnsAction,
		visibleMarkerLimit,
		setVisibleMarkerLimitAction,
		viewMode,
		setViewModeAction,
		selectedAlbumID,
		selectAlbumAction,
		startDate,
		endDate,
		setDateRangeAction
	});

	const catalogValue = useCatalogValue({
		albums: catalogDomain.albums,
		isLoadingAlbums: catalogDomain.isLoadingAlbums,
		albumsError: catalogDomain.albumsError,
		loadAlbumsAction: catalogDomain.loadAlbumsAction,
		assets: catalogDomain.assets,
		total: catalogDomain.total,
		currentPage: catalogDomain.currentPage,
		isLoadingAssets: catalogDomain.isLoadingAssets,
		assetsError: catalogDomain.assetsError,
		loadPageAction: catalogDomain.loadPageAction,
		suggestions,
		categories,
		suggestionsError,
		selectedAlbum
	});

	const selectionValue = useSelectionValue({
		selectedAssets,
		pendingLocation,
		pendingLocationsByAssetID,
		savedLocationsByAssetID,
		isSaving,
		saveError,
		toggleAssetAction,
		shiftSelectAction,
		selectAllAction,
		clearSelectionAction,
		clearSavedLocationsAction,
		setLocationAction,
		clearLocationAction,
		saveAction,
		undoLocationAction,
		redoLocationAction,
		canUndoLocation,
		canRedoLocation,
		beginLocationBatch,
		endLocationBatch,
		gpxStatusFilter,
		setGPXStatusFilterAction
	});

	const uiMapValue = useUIMapValue({
		focusedAssetID,
		clearFocusedAssetAction,
		focusMapAssetAction,
		lightboxAssetID,
		openLightboxAction,
		closeLightboxAction,
		mapMarkersVersion
	});

	const mapSceneValue = useMapSceneValue({
		gpsFilter,
		viewMode,
		selectedAlbumID,
		assets: catalogDomain.assets,
		selectedAssets,
		pendingLocation,
		pendingLocationsByAssetID,
		savedLocationsByAssetID,
		clearLocationAction,
		setLocationAction,
		clearSavedLocationsAction,
		toggleAssetAction,
		clearSelectionAction,
		openLightboxAction,
		closeLightboxAction,
		mapMarkersVersion
	});

	return {backendValue, viewValue, catalogValue, selectionValue, uiMapValue, mapSceneValue};
}
