'use client';

import {useCallback, useMemo} from 'react';

import {useAuth} from '@/features/auth/AuthContext';
import {UserMenu} from '@/features/auth/UserMenu';
import {useGPXImport} from '@/features/gpxImport/useGPXImport';
import {deriveAlreadyAppliedIDs} from '@/features/selection/selectionStateHelpers';
import {PhotoList} from '@/shared/components/PhotoList';
import {useBackend, useCatalog, useSelection, useUIMap, useView} from '@/shared/context/AppContext';

import type {TAlbumRow} from '@/shared/types/album';
import type {TViewMode} from '@/shared/types/view';
import type {ReactElement} from 'react';

/**
 * Container that resolves shared contexts and maps them into `PhotoList` props.
 *
 * This component acts as the composition boundary between context state and
 * presentational list rendering.
 *
 * @returns Rendered photo list with all required view/catalog/selection bindings.
 */
export function PhotoListContainer(): ReactElement {
	const {health, isSyncing, syncError, resyncAction} = useBackend();
	const {
		gpsFilter,
		setGPSFilterAction,
		pageSize,
		setPageSizeAction,
		gridColumns,
		setGridColumnsAction,
		visibleMarkerLimit,
		setVisibleMarkerLimitAction,
		viewMode,
		setViewModeAction,
		selectedAlbumID,
		selectAlbumAction
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
	const {clearSelectionAction, selectedAssets, pendingLocation, pendingLocationsByAssetID} = useSelection();
	const {closeLightboxAction} = useUIMap();

	const {
		step: gpxStep,
		isLoading: isGPXLoading,
		error: gpxError,
		preview: gpxPreview,
		uploadAndPreview: gpxUploadAndPreview,
		reset: gpxReset
	} = useGPXImport();

	const isGPXPanelActive = gpxStep === 'preview' && gpxPreview !== null;

	const selectedAlbum = useMemo<TAlbumRow | null>(
		() => albums.find(album => album.immichID === selectedAlbumID) ?? null,
		[albums, selectedAlbumID]
	);

	const albumMissingCount = albums.reduce((totalMissing, album) => totalMissing + album.noGPSCount, 0);
	const missingCount = selectedAlbum
		? selectedAlbum.noGPSCount
		: albums.length > 0
			? albumMissingCount
			: (health?.noGPSAssets ?? null);
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

	let gpxImportProp:
		| {
				uploadAndPreview: (file: File, maxGapSeconds?: number) => Promise<void>;
				isLoading: boolean;
				error: string | null;
		  }
		| undefined = {
		uploadAndPreview: gpxUploadAndPreview,
		isLoading: isGPXLoading,
		error: gpxError
	};
	if (isGPXPanelActive) {
		gpxImportProp = undefined;
	}

	return (
		<PhotoList
			backend={{
				health,
				isSyncing,
				syncError,
				onResyncAction: resyncAction
			}}
			view={{
				gpsFilter,
				pageSize,
				gridColumns,
				visibleMarkerLimit,
				visibleMarkerTotalCount: mapMarkerCount,
				viewMode,
				selectedAlbumID,
				selectedAlbum,
				missingCount,
				onGPSFilterAction: setGPSFilterAction,
				onPageSizeAction: setPageSizeAction,
				onGridColumnsAction: setGridColumnsAction,
				onVisibleMarkerLimitAction: setVisibleMarkerLimitAction,
				onViewModeAction: handleToggleViewMode,
				onBackToAlbumsAction: handleBackToAlbums,
				gpxPreview,
				gpxError,
				onGPXResetAction: gpxReset,
				onGPXCancelAction: handleGPXCancel,
				trailingAction: <UserMenu gpxImport={gpxImportProp} />
			}}
			catalog={{
				albums,
				assets,
				total,
				currentPage,
				isLoadingAlbums,
				albumsError,
				isLoadingAssets,
				assetsError,
				onLoadPageAction: handleLoadPageAction,
				onSelectAlbumAction: handleSelectAlbum,
				onRetrySyncAction: async () => resyncAction()
			}}
			selection={{
				selectedIDs,
				alreadyAppliedIDs
			}}
		/>
	);
}
