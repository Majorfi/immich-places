'use client';

import {AlbumList} from '@/features/albums/AlbumList';
import {FilterBar} from '@/features/filterBar/FilterBar';
import {GPXImportPanel} from '@/features/gpxImport/GPXImportPanel';
import {PhotoGrid} from '@/features/photoGrid/PhotoGrid';
import {PaginationFooter} from '@/shared/components/PaginationFooter';
import {PHOTO_GRID_FADE_ANIMATION} from '@/utils/photoGrid';

import type {TGPXPreviewResponse} from '@/features/gpxImport/gpxImportTypes';
import type {TAlbumRow} from '@/shared/types/album';
import type {TAssetRow} from '@/shared/types/asset';
import type {TGPSFilter, TGPXStatusFilter, THiddenFilter} from '@/shared/types/map';
import type {TViewMode} from '@/shared/types/view';
import type {CSSProperties, ReactElement} from 'react';

const listClass =
	'flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-(--color-border) bg-(--color-surface)';
const contentClass = 'flex min-h-0 flex-1 flex-col';

type TPhotoListProps = {
	backend: {
		isSyncing: boolean;
		syncError: string | null;
		onResyncAction: () => Promise<void>;
	};
	view: {
		gpsFilter: TGPSFilter;
		hiddenFilter: THiddenFilter;
		pageSize: number;
		gridColumns: number;
		visibleMarkerLimit: number;
		visibleMarkerTotalCount: number;
		viewMode: TViewMode;
		selectedAlbumID: string | null;
		selectedAlbum: TAlbumRow | null;
		missingCount: number | null;
		onGPSFilterAction: (filter: TGPSFilter) => void;
		onHiddenFilterAction: (filter: THiddenFilter) => void;
		onPageSizeAction: (size: number) => void;
		onGridColumnsAction: (cols: number) => void;
		onVisibleMarkerLimitAction: (limit: number) => void;
		onViewModeAction: (mode: TViewMode) => void;
		onBackToAlbumsAction: () => void;
		startDate: string | null;
		endDate: string | null;
		onDateRangeAction: (startDate: string | null, endDate: string | null) => void;
		gpxPreviews: TGPXPreviewResponse[];
		gpxError: string | null;
		onGPXResetAction: () => void;
		onGPXCancelAction: () => void;
		trailingAction?: ReactElement;
		gpxStatusFilter: TGPXStatusFilter;
		onGPXStatusFilterAction: (filter: TGPXStatusFilter) => void;
	};
	catalog: {
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
		alreadyAppliedIDs: Set<string>;
	};
};

function staggerStyle(delayMs: number): CSSProperties {
	return {
		animation: 'elFadeIn 300ms ease-out both',
		animationDelay: `${delayMs}ms`
	};
}

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

export function PhotoList({backend, view, catalog, selection}: TPhotoListProps): ReactElement {
	const {isSyncing, syncError} = backend;
	const {
		gpsFilter,
		hiddenFilter,
		pageSize,
		gridColumns,
		visibleMarkerLimit,
		visibleMarkerTotalCount,
		viewMode,
		selectedAlbumID,
		selectedAlbum,
		onGPSFilterAction,
		onHiddenFilterAction,
		onPageSizeAction,
		onGridColumnsAction,
		onVisibleMarkerLimitAction,
		onViewModeAction,
		onBackToAlbumsAction,
		startDate,
		endDate,
		onDateRangeAction,
		gpxPreviews,
		gpxError,
		onGPXResetAction,
		onGPXCancelAction,
		gpxStatusFilter,
		onGPXStatusFilterAction
	} = view;
	const {
		assets,
		total,
		currentPage,
		isLoadingAssets,
		assetsError,
		onLoadPageAction,
		onSelectAlbumAction,
		onRetrySyncAction
	} = catalog;
	const {selectedIDs, alreadyAppliedIDs} = selection;

	const shouldShowAlbumList = viewMode === 'album' && !selectedAlbumID;
	const shouldShowAlbumDetail = viewMode === 'album' && Boolean(selectedAlbumID) && selectedAlbum !== null;

	const totalPages = Math.max(1, Math.ceil(total / pageSize));
	const contentKey = buildContentKey(shouldShowAlbumList, shouldShowAlbumDetail, viewMode, selectedAlbumID);
	let scrollResetKey = `${viewMode}:${currentPage}`;
	if (selectedAlbumID) {
		scrollResetKey = `${viewMode}:${selectedAlbumID}:${currentPage}`;
	}

	const isGPXActive = gpxPreviews.length > 0;
	let mobileMaxVisibleRows: number | null = null;
	if (shouldShowAlbumDetail) {
		mobileMaxVisibleRows = 1.8;
	}
	let effectiveAlbumName = selectedAlbum?.albumName;
	let effectiveBackAction = onBackToAlbumsAction;
	if (isGPXActive) {
		if (gpxPreviews.length > 1) {
			effectiveAlbumName = `GPX Import (${gpxPreviews.length} tracks)`;
		} else {
			effectiveAlbumName = 'GPX Import';
		}
		effectiveBackAction = onGPXCancelAction;
	}

	return (
		<div className={listClass}>
			<FilterBar
				gpsFilter={gpsFilter}
				onGPSFilterAction={onGPSFilterAction}
				hiddenFilter={hiddenFilter}
				onHiddenFilterAction={onHiddenFilterAction}
				missingCount={view.missingCount}
				pageSize={pageSize}
				onPageSizeAction={onPageSizeAction}
				gridColumns={gridColumns}
				onGridColumnsAction={onGridColumnsAction}
				visibleMarkerLimit={visibleMarkerLimit}
				visibleMarkerTotalCount={visibleMarkerTotalCount}
				onVisibleMarkerLimitAction={onVisibleMarkerLimitAction}
				viewMode={viewMode}
				onViewModeAction={onViewModeAction}
				startDate={startDate}
				endDate={endDate}
				onDateRangeAction={onDateRangeAction}
				isSyncing={isSyncing}
				syncError={syncError}
				onSyncAction={onRetrySyncAction}
				albumName={effectiveAlbumName}
				onBackAction={effectiveBackAction}
				trailingAction={view.trailingAction}
				hideSettingsOnMobile={shouldShowAlbumDetail}
				isGPXActive={isGPXActive}
				gpxStatusFilter={gpxStatusFilter}
				onGPXStatusFilterAction={onGPXStatusFilterAction}
			/>
			{isGPXActive && (
				<GPXImportPanel
					previews={gpxPreviews}
					error={gpxError}
					onReset={onGPXResetAction}
				/>
			)}
			{!isGPXActive && (
				<div
					key={contentKey}
					className={contentClass}>
					{shouldShowAlbumList && (
						<div className={'flex-1 overflow-y-auto'}>
							<AlbumList
								onSelectAction={onSelectAlbumAction}
								animation={PHOTO_GRID_FADE_ANIMATION}
								isSyncing={isSyncing}
							/>
						</div>
					)}
					{!shouldShowAlbumList && (
						<PhotoGrid
							assets={assets}
							selectedIDs={selectedIDs}
							alreadyAppliedIDs={alreadyAppliedIDs}
							scrollResetKey={scrollResetKey}
							gpsFilter={gpsFilter}
							gridColumns={gridColumns}
							isLoading={isLoadingAssets}
							isSyncing={isSyncing}
							error={assetsError}
							mobileMaxVisibleRows={mobileMaxVisibleRows}
						/>
					)}
					{!shouldShowAlbumList && total > 0 && (
						<div style={staggerStyle(150)}>
							<PaginationFooter
								currentPage={currentPage}
								totalPages={totalPages}
								isLoading={isLoadingAssets}
								onPageChangeAction={onLoadPageAction}
							/>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
