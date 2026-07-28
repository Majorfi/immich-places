'use client';

import {useCallback, useEffect} from 'react';

import {useURLState} from '@/features/filterBar/useURLState';
import {clampVisibleMarkerLimit} from '@/utils/view';

import type {TViewContextValue} from '@/shared/types/context';
import type {TGPSFilter, THiddenFilter} from '@/shared/types/map';
import type {TViewMode} from '@/shared/types/view';

type TViewDomain = {
	gpsFilter: TGPSFilter;
	hiddenFilter: THiddenFilter;
	pageSize: number;
	setPageSizeAction: (size: number) => void;
	gridColumns: number;
	setGridColumnsAction: (cols: number) => void;
	visibleMarkerLimit: number;
	setVisibleMarkerLimitAction: (limit: number) => void;
	viewMode: TViewMode;
	setViewModeAction: (mode: TViewMode) => void;
	selectedAlbumID: string | null;
	selectedFolderPath: string | null;
	selectedTagID: string | null;
	startDate: string | null;
	endDate: string | null;
	setGPSFilterRawAction: (filter: TGPSFilter) => void;
	setHiddenFilterRawAction: (filter: THiddenFilter) => void;
	setSelectedAlbumIDAction: (albumID: string | null) => void;
	setSelectedFolderPathAction: (folderPath: string | null) => void;
	setSelectedTagIDAction: (tagID: string | null) => void;
	setGPSFilterAction: TViewContextValue['setGPSFilterAction'];
	setHiddenFilterAction: TViewContextValue['setHiddenFilterAction'];
	selectAlbumAction: TViewContextValue['selectAlbumAction'];
	selectFolderAction: TViewContextValue['selectFolderAction'];
	selectTagAction: TViewContextValue['selectTagAction'];
	setDateRangeAction: (startDate: string | null, endDate: string | null) => void;
};

export function useViewDomain(): TViewDomain {
	const {
		gpsFilter,
		setGPSFilterRawAction,
		hiddenFilter,
		setHiddenFilterRawAction,
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
		selectedFolderPath,
		setSelectedFolderPathAction,
		selectedTagID,
		setSelectedTagIDAction,
		startDate,
		setStartDateAction,
		endDate,
		setEndDateAction,
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

	const setHiddenFilter = useCallback(
		(filter: THiddenFilter) => {
			if (filter === hiddenFilter) {
				return;
			}
			setHiddenFilterRawAction(filter);
			syncURLAction({hiddenFilter: filter});
		},
		[hiddenFilter, setHiddenFilterRawAction, syncURLAction]
	);

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

	const selectAlbumAction = useCallback(
		(albumID: string | null) => {
			setSelectedAlbumIDAction(albumID);
			syncURLAction({selectedAlbumID: albumID});
		},
		[setSelectedAlbumIDAction, syncURLAction]
	);

	const selectFolderAction = useCallback(
		(folderPath: string | null) => {
			setSelectedFolderPathAction(folderPath);
			syncURLAction({selectedFolderPath: folderPath});
		},
		[setSelectedFolderPathAction, syncURLAction]
	);

	const selectTagAction = useCallback(
		(tagID: string | null) => {
			setSelectedTagIDAction(tagID);
			syncURLAction({selectedTagID: tagID});
		},
		[setSelectedTagIDAction, syncURLAction]
	);

	const setDateRangeAction = useCallback(
		(nextStartDate: string | null, nextEndDate: string | null) => {
			setStartDateAction(nextStartDate);
			setEndDateAction(nextEndDate);
			syncURLAction({startDate: nextStartDate, endDate: nextEndDate});
		},
		[setStartDateAction, setEndDateAction, syncURLAction]
	);

	useEffect(() => {
		if (viewMode === 'album' && selectedAlbumID === null && selectedTagID !== null) {
			selectTagAction(null);
		}
	}, [viewMode, selectedAlbumID, selectedTagID, selectTagAction]);

	return {
		gpsFilter,
		hiddenFilter,
		setGPSFilterRawAction,
		setHiddenFilterRawAction,
		pageSize,
		setPageSizeAction: handleSetPageSize,
		gridColumns,
		setGridColumnsAction: handleSetGridColumns,
		visibleMarkerLimit,
		setVisibleMarkerLimitAction: handleSetVisibleMarkerLimit,
		viewMode,
		setViewModeAction: handleSetViewMode,
		selectedAlbumID,
		selectedFolderPath,
		selectedTagID,
		startDate,
		endDate,
		setSelectedAlbumIDAction,
		setSelectedFolderPathAction,
		setSelectedTagIDAction,
		setGPSFilterAction: setGPSFilter,
		setHiddenFilterAction: setHiddenFilter,
		selectAlbumAction,
		selectFolderAction,
		selectTagAction,
		setDateRangeAction
	};
}
