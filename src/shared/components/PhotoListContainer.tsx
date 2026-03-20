'use client';

import {useCallback, useMemo} from 'react';

import {useAuth} from '@/features/auth/AuthContext';
import {UserMenu} from '@/features/auth/UserMenu';
import {useGPXImportContext} from '@/features/gpxImport/GPXImportContext';
import {deriveAlreadyAppliedIDs} from '@/features/selection/selectionStateHelpers';
import {PhotoList} from '@/shared/components/PhotoList';
import {useBackend, useCatalog, useSelection, useUIMap, useView} from '@/shared/context/AppContext';

import type {TAlbumRow} from '@/shared/types/album';
import type {TViewMode} from '@/shared/types/view';
import type {ReactElement} from 'react';

export function PhotoListContainer(): ReactElement {
	const {health, isSyncing, syncError, resyncAction} = useBackend();
	const {
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
	} = useView();
	const {
		albums,
		isLoadingAlbums,
		albumsError,
		assets,
		total,
		currentPage,
		isLoadingAssets,
		assetsError,
		loadPageAction
	} = useCatalog();
	const {mapMarkerCount} = useAuth();
	const {
		clearSelectionAction,
		selectedAssets,
		pendingLocation,
		pendingLocationsByAssetID,
		gpxStatusFilter,
		setGPXStatusFilterAction
	} = useSelection();
	const {closeLightboxAction} = useUIMap();

	const {
		step: gpxStep,
		isLoading: isGPXLoading,
		error: gpxError,
		previews: gpxPreviews,
		uploadAndPreview: gpxUploadAndPreview,
		setPreviews: gpxSetPreviews,
		reset: gpxReset
	} = useGPXImportContext();

	const isGPXPanelActive = gpxStep === 'preview' && gpxPreviews.length > 0;

	const selectedAlbum = useMemo<TAlbumRow | null>(
		() => albums.find(album => album.immichID === selectedAlbumID) ?? null,
		[albums, selectedAlbumID]
	);

	const albumMissingCount = albums.reduce((totalMissing, album) => totalMissing + album.noGPSCount, 0);

	let missingCount: number | null;
	if (selectedAlbum) {
		missingCount = selectedAlbum.noGPSCount;
	} else if (albums.length > 0) {
		missingCount = albumMissingCount;
	} else {
		missingCount = health?.noGPSAssets ?? null;
	}
	const selectedIDs = useMemo(() => new Set(selectedAssets.map(a => a.immichID)), [selectedAssets]);
	const alreadyAppliedIDs = useMemo(
		() => deriveAlreadyAppliedIDs(pendingLocationsByAssetID),
		[pendingLocationsByAssetID]
	);
	const pendingImageCount = useMemo(() => Object.keys(pendingLocationsByAssetID).length, [pendingLocationsByAssetID]);

	const hasPendingLocationChanges = pendingImageCount > 0 || (selectedAssets.length > 0 && pendingLocation !== null);
	const confirmCloseAlbum = useCallback(() => {
		if (!hasPendingLocationChanges) {
			return true;
		}
		return window.confirm('You have unsaved location edits. Do you want to discard them and continue?');
	}, [hasPendingLocationChanges]);

	const clearPendingState = useCallback(() => {
		clearSelectionAction();
	}, [clearSelectionAction]);

	const closeAlbumAndClearPending = useCallback(
		(nextModeAction: () => void): void => {
			if (!confirmCloseAlbum()) {
				return;
			}
			clearPendingState();
			nextModeAction();
		},
		[clearPendingState, confirmCloseAlbum]
	);

	const handleToggleViewMode = (mode: TViewMode): void => {
		if (mode === viewMode) {
			return;
		}
		if (selectedAlbumID) {
			closeAlbumAndClearPending(() => {
				closeLightboxAction();
				selectAlbumAction(null);
				setViewModeAction(mode);
			});
			return;
		}
		closeLightboxAction();
		setViewModeAction(mode);
	};

	const handleBackToAlbums = (): void => {
		if (!selectedAlbumID) {
			return;
		}
		closeAlbumAndClearPending(() => {
			closeLightboxAction();
			selectAlbumAction(null);
		});
	};

	const handleSelectAlbum = (albumID: string): void => {
		if (selectedAlbumID === albumID) {
			return;
		}
		if (selectedAlbumID) {
			closeAlbumAndClearPending(() => {
				closeLightboxAction();
				selectAlbumAction(albumID);
			});
			return;
		}
		closeLightboxAction();
		selectAlbumAction(albumID);
	};

	const handleLoadPageAction = async (page: number): Promise<void> => {
		clearSelectionAction();
		return loadPageAction(page);
	};

	const handleGPXCancel = useCallback((): void => {
		if (!confirmCloseAlbum()) {
			return;
		}
		clearPendingState();
		gpxReset();
	}, [confirmCloseAlbum, clearPendingState, gpxReset]);

	const handleGPXAutoReset = useCallback((): void => {
		clearPendingState();
		gpxReset();
	}, [clearPendingState, gpxReset]);

	let activeGPXPreviews: typeof gpxPreviews = [];
	if (isGPXPanelActive) {
		activeGPXPreviews = gpxPreviews;
	}

	let gpxImportProp:
		| {
				uploadAndPreview: (files: File[], maxGapSeconds?: number) => Promise<void>;
				setPreviews: (previews: typeof gpxPreviews) => void;
				isLoading: boolean;
				error: string | null;
		  }
		| undefined;
	if (!isGPXPanelActive) {
		gpxImportProp = {
			uploadAndPreview: gpxUploadAndPreview,
			setPreviews: gpxSetPreviews,
			isLoading: isGPXLoading,
			error: gpxError
		};
	}

	return (
		<PhotoList
			backend={{
				isSyncing,
				syncError,
				onResyncAction: resyncAction
			}}
			view={{
				gpsFilter,
				hiddenFilter,
				pageSize,
				gridColumns,
				visibleMarkerLimit,
				visibleMarkerTotalCount: mapMarkerCount,
				viewMode,
				selectedAlbumID,
				selectedAlbum,
				missingCount,
				onGPSFilterAction: setGPSFilterAction,
				onHiddenFilterAction: setHiddenFilterAction,
				onPageSizeAction: setPageSizeAction,
				onGridColumnsAction: setGridColumnsAction,
				onVisibleMarkerLimitAction: setVisibleMarkerLimitAction,
				onViewModeAction: handleToggleViewMode,
				onBackToAlbumsAction: handleBackToAlbums,
				gpxPreviews: activeGPXPreviews,
				gpxError,
				startDate,
				endDate,
				onDateRangeAction: setDateRangeAction,
				onGPXResetAction: handleGPXAutoReset,
				onGPXCancelAction: handleGPXCancel,
				trailingAction: <UserMenu gpxImport={gpxImportProp} />,
				gpxStatusFilter,
				onGPXStatusFilterAction: setGPXStatusFilterAction
			}}
			catalog={{
				assets,
				total,
				currentPage,
				isLoadingAlbums,
				albumsError,
				isLoadingAssets,
				assetsError,
				onLoadPageAction: handleLoadPageAction,
				onSelectAlbumAction: handleSelectAlbum,
				onRetrySyncAction: resyncAction
			}}
			selection={{
				selectedIDs,
				alreadyAppliedIDs
			}}
		/>
	);
}
