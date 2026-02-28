'use client';

import {AlbumList} from '@/features/albums/AlbumList';
import {FilterBar} from '@/features/filterBar/FilterBar';
import {PhotoGrid} from '@/features/photoGrid/PhotoGrid';
import {PaginationFooter} from '@/shared/components/PaginationFooter';
import {PHOTO_GRID_FADE_ANIMATION} from '@/utils/photoGrid';

import type {TAlbumRow} from '@/shared/types/album';
import type {TAssetRow} from '@/shared/types/asset';
import type {THealthResponse} from '@/shared/types/health';
import type {TGPSFilter} from '@/shared/types/map';
import type {TViewMode} from '@/shared/types/view';
import type {CSSProperties, ReactElement} from 'react';

/**
 * Card/list container styling for the shared photo list wrapper.
 */
const listClass =
	'flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-(--color-border) bg-(--color-surface)';
/**
 * Main content wrapper styling for album and timeline modes.
 */
const contentClass = 'flex min-h-0 flex-1 flex-col';

/**
 * Props contract for rendering the shared photo list composition component.
 */
type TPhotoListProps = {
	backend: {
		health: THealthResponse | null;
		isSyncing: boolean;
		syncError: string | null;
		onResyncAction: () => Promise<void>;
	};
	view: {
		gpsFilter: TGPSFilter;
		pageSize: number;
		gridColumns: number;
		visibleMarkerLimit: number;
		visibleMarkerTotalCount: number;
		viewMode: TViewMode;
		selectedAlbumID: string | null;
		selectedAlbum: TAlbumRow | null;
		missingCount: number | null;
		onGPSFilterAction: (filter: TGPSFilter) => void;
		onPageSizeAction: (size: number) => void;
		onGridColumnsAction: (cols: number) => void;
		onVisibleMarkerLimitAction: (limit: number) => void;
		onViewModeAction: (mode: TViewMode) => void;
		onBackToAlbumsAction: () => void;
		trailingAction?: ReactElement;
	};
	catalog: {
		albums: TAlbumRow[];
		assets: TAssetRow[];
		total: number;
		currentPage: number;
		isLoadingAlbums: boolean;
		albumsError: string | null;
		isLoadingAssets: boolean;
		assetsError: string | null;
		onLoadPageAction: (page: number) => Promise<void>;
		onSelectAlbumAction: (albumID: string) => void;
		onRetrySyncAction: () => Promise<void>;
	};
	selection: {
		selectedIDs: Set<string>;
	};
};

/**
 * Generate consistent stagger animation style for the pagination footer reveal.
 *
 * @param delayMs - Delay in milliseconds for animation start.
 * @returns CSSProperties object for the inline animation.
 */
function staggerStyle(delayMs: number): CSSProperties {
	return {
		animation: 'elFadeIn 300ms ease-out both',
		animationDelay: `${delayMs}ms`
	};
}

/**
 * Build a stable render key that switches content modes without stale state bleed.
 *
 * @param shouldShowAlbumList - Whether album overview mode is active.
 * @param shouldShowAlbumDetail - Whether album detail mode is active.
 * @param viewMode - Current view mode.
 * @param selectedAlbumID - Currently selected album identifier.
 * @returns String key for keyed subtree resets.
 */
function buildContentKey(
	shouldShowAlbumList: boolean,
	shouldShowAlbumDetail: boolean,
	viewMode: TViewMode,
	selectedAlbumID: string | null
): string {
	if (shouldShowAlbumList) {
		return 'album-list';
	}
	if (shouldShowAlbumDetail) {
		return `detail-${selectedAlbumID ?? ''}:${viewMode}`;
	}
	return 'timeline';
}

/**
 * Composes the main app photo list shell for albums and assets.
 *
 * Orchestrates filter bar interactions, album listing, photo grid rendering,
 * and pagination depending on the active mode and selected album context.
 *
 * @param props - Backend, view, catalog, and selection slices.
 * @returns Rendered list container with mode-specific content.
 */
export function PhotoList({backend, view, catalog, selection}: TPhotoListProps): ReactElement {
	const {health, isSyncing, syncError} = backend;
	const {
		gpsFilter,
		pageSize,
		gridColumns,
		visibleMarkerLimit,
		visibleMarkerTotalCount,
		viewMode,
		selectedAlbumID,
		selectedAlbum,
		onGPSFilterAction,
		onPageSizeAction,
		onGridColumnsAction,
		onVisibleMarkerLimitAction,
		onViewModeAction,
		onBackToAlbumsAction
	} = view;
	const {
		albums,
		assets,
		total,
		currentPage,
		isLoadingAssets,
		assetsError,
		onLoadPageAction,
		onSelectAlbumAction,
		onRetrySyncAction
	} = catalog;
	const {selectedIDs} = selection;

	const shouldShowAlbumList = viewMode === 'album' && !selectedAlbumID;
	const shouldShowAlbumDetail = viewMode === 'album' && Boolean(selectedAlbumID) && selectedAlbum !== null;

	const albumViewMissingCount = albums.reduce((sum, album) => sum + album.noGPSCount, 0);
	const globalMissingCount = albums.length > 0 ? albumViewMissingCount : (health?.noGPSAssets ?? null);
	const effectiveMissingCount = selectedAlbum
		? selectedAlbum.noGPSCount
		: selectedAlbumID
			? null
			: globalMissingCount;
	const totalPages = Math.max(1, Math.ceil(total / pageSize));
	const contentKey = buildContentKey(shouldShowAlbumList, shouldShowAlbumDetail, viewMode, selectedAlbumID);
	let scrollResetKey = `${viewMode}:${currentPage}`;
	if (selectedAlbumID) {
		scrollResetKey = `${viewMode}:${selectedAlbumID}:${currentPage}`;
	}

	return (
		<div className={listClass}>
			<FilterBar
				gpsFilter={gpsFilter}
				onGPSFilterAction={onGPSFilterAction}
				missingCount={effectiveMissingCount}
				pageSize={pageSize}
				onPageSizeAction={onPageSizeAction}
				gridColumns={gridColumns}
				onGridColumnsAction={onGridColumnsAction}
				visibleMarkerLimit={visibleMarkerLimit}
				visibleMarkerTotalCount={visibleMarkerTotalCount}
				onVisibleMarkerLimitAction={onVisibleMarkerLimitAction}
				viewMode={viewMode}
				onViewModeAction={onViewModeAction}
				isSyncing={isSyncing}
				syncError={syncError}
				onSyncAction={onRetrySyncAction}
				albumName={selectedAlbum?.albumName}
				onBackAction={onBackToAlbumsAction}
				trailingAction={view.trailingAction}
			/>
			<div
				key={contentKey}
				className={contentClass}>
				{shouldShowAlbumList ? (
					<div className={'flex-1 overflow-y-auto'}>
						<AlbumList
							onSelectAction={onSelectAlbumAction}
							animation={PHOTO_GRID_FADE_ANIMATION}
							isSyncing={isSyncing}
						/>
					</div>
				) : (
					<PhotoGrid
						assets={assets}
						selectedIDs={selectedIDs}
						scrollResetKey={scrollResetKey}
						gpsFilter={gpsFilter}
						gridColumns={gridColumns}
						isLoading={isLoadingAssets}
						isSyncing={isSyncing}
						error={assetsError}
					/>
				)}
				{!shouldShowAlbumList && total > 0 ? (
					<div style={staggerStyle(150)}>
						<PaginationFooter
							currentPage={currentPage}
							totalPages={totalPages}
							isLoading={isLoadingAssets}
							onPageChangeAction={onLoadPageAction}
						/>
					</div>
				) : null}
			</div>
		</div>
	);
}
