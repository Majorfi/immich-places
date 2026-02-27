'use client';

import {useCallback} from 'react';

import {useURLState} from '@/features/filterBar/useURLState';
import {clampVisibleMarkerLimit} from '@/utils/view';

import type {TViewContextValue} from '@/shared/types/context';
import type {TGPSFilter} from '@/shared/types/map';
import type {TViewMode} from '@/shared/types/view';

/**
 * View domain values and action contract exposed by URL-backed state.
 */
type TViewDomain = {
	gpsFilter: TGPSFilter;
	pageSize: number;
	setPageSizeAction: (size: number) => void;
	gridColumns: number;
	setGridColumnsAction: (cols: number) => void;
	visibleMarkerLimit: number;
	setVisibleMarkerLimitAction: (limit: number) => void;
	viewMode: TViewMode;
	setViewModeAction: (mode: TViewMode) => void;
	selectedAlbumID: string | null;
	setGPSFilterRawAction: (filter: TGPSFilter) => void;
	setSelectedAlbumIDAction: (albumID: string | null) => void;
	setGPSFilterAction: TViewContextValue['setGPSFilterAction'];
	selectAlbumAction: TViewContextValue['selectAlbumAction'];
};

/**
 * Builds view-domain actions that keep URL state synchronized.
 *
 * Wraps raw setters with no-op guards and URL sync for:
 * - GPS filter
 * - page size
 * - grid columns
 * - view mode
 * - selected album
 *
 * @returns Normalized view domain values and handlers.
 */
export function useViewDomain(): TViewDomain {
	const {
		gpsFilter,
		setGPSFilterRawAction,
		pageSize,
		setPageSizeAction,
		gridColumns,
		setGridColumnsAction,
		visibleMarkerLimit,
		setVisibleMarkerLimitAction,
		viewMode,
		setViewModeAction,
		selectedAlbumID,
		setSelectedAlbumIDAction,
		syncURLAction
	} = useURLState();

	const setGPSFilter = useCallback(
		(filter: TGPSFilter) => {
			if (filter === gpsFilter) {
				return;
			}
			setGPSFilterRawAction(filter);
			syncURLAction({gpsFilter: filter});
		},
		[gpsFilter, setGPSFilterRawAction, syncURLAction]
	);

	/**
	 * Update page size only when changed and sync it to URL.
	 *
	 * @param size - New page size value.
	 */
	const handleSetPageSize = useCallback(
		(size: number) => {
			if (size === pageSize) {
				return;
			}
			setPageSizeAction(size);
			syncURLAction({pageSize: size});
		},
		[pageSize, setPageSizeAction, syncURLAction]
	);

	/**
	 * Update grid columns only when changed and sync it to URL.
	 *
	 * @param cols - New column count.
	 */
	const handleSetGridColumns = useCallback(
		(cols: number) => {
			if (cols === gridColumns) {
				return;
			}
			setGridColumnsAction(cols);
			syncURLAction({gridColumns: cols});
		},
		[gridColumns, setGridColumnsAction, syncURLAction]
	);

	/**
	 * Update visible marker limit only when changed and sync it to URL.
	 *
	 * @param limit - New visible marker cap.
	 */
	const handleSetVisibleMarkerLimit = useCallback(
		(limit: number) => {
			const normalizedLimit = clampVisibleMarkerLimit(limit);
			if (normalizedLimit === visibleMarkerLimit) {
				return;
			}
			setVisibleMarkerLimitAction(normalizedLimit);
			syncURLAction({visibleMarkerLimit: normalizedLimit});
		},
		[visibleMarkerLimit, setVisibleMarkerLimitAction, syncURLAction]
	);

	/**
	 * Update view mode only when changed and sync it to URL.
	 *
	 * @param mode - New timeline/album view mode.
	 */
	const handleSetViewMode = useCallback(
		(mode: TViewMode) => {
			if (mode === viewMode) {
				return;
			}
			setViewModeAction(mode);
			syncURLAction({viewMode: mode});
		},
		[viewMode, setViewModeAction, syncURLAction]
	);

	/**
	 * Update active album selection and sync it to URL.
	 *
	 * @param albumID - Selected album ID or null.
	 */
	const selectAlbumAction = useCallback(
		(albumID: string | null) => {
			setSelectedAlbumIDAction(albumID);
			syncURLAction({selectedAlbumID: albumID});
		},
		[setSelectedAlbumIDAction, syncURLAction]
	);

	return {
		gpsFilter,
		setGPSFilterRawAction,
		pageSize,
		setPageSizeAction: handleSetPageSize,
		gridColumns,
		setGridColumnsAction: handleSetGridColumns,
		visibleMarkerLimit,
		setVisibleMarkerLimitAction: handleSetVisibleMarkerLimit,
		viewMode,
		setViewModeAction: handleSetViewMode,
		selectedAlbumID,
		setSelectedAlbumIDAction,
		setGPSFilterAction: setGPSFilter,
		selectAlbumAction
	};
}
