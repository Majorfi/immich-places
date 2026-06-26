'use client';

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import {ALLOWED_GRID_COLUMNS, ALLOWED_PAGE_SIZES} from '@/features/filterBar/constant';
import {
	DEFAULT_GRID_COLUMNS,
	DEFAULT_PAGE_SIZE,
	DEFAULT_VISIBLE_MARKER_LIMIT,
	GPS_FILTER_DEFAULT,
	GPS_FILTER_NO_GPS,
	GPS_FILTER_WITH_GPS,
	HIDDEN_FILTER_DEFAULT,
	URL_PARAM_ALBUM_ID,
	URL_PARAM_END_DATE,
	URL_PARAM_GPS_FILTER,
	URL_PARAM_GRID_COLUMNS,
	URL_PARAM_HIDDEN_FILTER,
	URL_PARAM_MARKER_LIMIT,
	URL_PARAM_PAGE_SIZE,
	URL_PARAM_START_DATE,
	URL_PARAM_TAG_ID,
	URL_PARAM_VIEW_MODE,
	VIEW_MODE_DEFAULT,
	clampVisibleMarkerLimit
} from '@/utils/view';

import type {TGPSFilter, THiddenFilter} from '@/shared/types/map';
import type {TViewMode} from '@/shared/types/view';

type TURLSyncState = {
	gpsFilter: TGPSFilter;
	hiddenFilter: THiddenFilter;
	viewMode: TViewMode;
	selectedAlbumID: string | null;
	selectedTagID: string | null;
	pageSize: number;
	gridColumns: number;
	visibleMarkerLimit: number;
	startDate: string | null;
	endDate: string | null;
};

type TURLState = {
	gpsFilter: TGPSFilter;
	setGPSFilterRawAction: (filter: TGPSFilter) => void;
	hiddenFilter: THiddenFilter;
	setHiddenFilterRawAction: (filter: THiddenFilter) => void;
	pageSize: number;
	setPageSizeAction: (size: number) => void;
	gridColumns: number;
	setGridColumnsAction: (cols: number) => void;
	visibleMarkerLimit: number;
	setVisibleMarkerLimitAction: (limit: number) => void;
	viewMode: TViewMode;
	setViewModeAction: (mode: TViewMode) => void;
	selectedAlbumID: string | null;
	setSelectedAlbumIDAction: (albumID: string | null) => void;
	selectedTagID: string | null;
	setSelectedTagIDAction: (tagID: string | null) => void;
	startDate: string | null;
	setStartDateAction: (date: string | null) => void;
	endDate: string | null;
	setEndDateAction: (date: string | null) => void;
	buildURL: (state?: Partial<TURLSyncState>) => string;
	syncURLAction: (state?: Partial<TURLSyncState>) => void;
};

type TURLSyncEnvironment = {
	readSearch: () => string;
	readPathname: () => string;
	replacePath: (path: string) => void;
	subscribePopstate: (listener: () => void) => () => void;
};

const MAX_ALBUM_ID_LENGTH = 256;

function sanitizeAlbumID(albumID: string | null): string | null {
	if (!albumID) {
		return null;
	}
	const trimmed = albumID.trim();
	if (!trimmed || trimmed.length > MAX_ALBUM_ID_LENGTH) {
		return null;
	}
	if (/\s/.test(trimmed) || /[^\x20-\x7E]/.test(trimmed)) {
		return null;
	}
	return trimmed;
}

function createBrowserURLSync(): TURLSyncEnvironment | null {
	if (typeof window === 'undefined') {
		return null;
	}

	return {
		readSearch: () => window.location.search,
		readPathname: () => window.location.pathname,
		replacePath: path => {
			window.history.replaceState(null, '', path);
		},
		subscribePopstate: listener => {
			window.addEventListener('popstate', listener);
			return () => {
				window.removeEventListener('popstate', listener);
			};
		}
	};
}

function normalizePageParam(value: string | null, defaultsTo: number, allowed: Set<number>): number {
	const parsed = Number.parseInt(value ?? '', 10);
	if (!Number.isFinite(parsed)) {
		return defaultsTo;
	}
	if (allowed.has(parsed)) {
		return parsed;
	}
	return defaultsTo;
}

function normalizeVisibleMarkerLimitParam(value: string | null): number {
	const parsed = Number.parseInt(value ?? '', 10);
	if (!Number.isFinite(parsed)) {
		return DEFAULT_VISIBLE_MARKER_LIMIT;
	}
	return clampVisibleMarkerLimit(parsed);
}

function parseGPSFilter(value: string | null): TGPSFilter {
	if (value === GPS_FILTER_NO_GPS || value === GPS_FILTER_WITH_GPS) {
		return value;
	}
	return GPS_FILTER_DEFAULT;
}

function parseHiddenFilter(value: string | null): THiddenFilter {
	if (value === 'all' || value === 'hidden' || value === 'visible') {
		return value;
	}
	return HIDDEN_FILTER_DEFAULT;
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseURLDate(value: string | null): string | null {
	if (value && ISO_DATE_PATTERN.test(value)) {
		return value;
	}
	return null;
}

function resolveNullableOverride<TKey extends keyof TURLSyncState>(
	state: Partial<TURLSyncState> | undefined,
	key: TKey,
	fallback: TURLSyncState[TKey]
): TURLSyncState[TKey] {
	if (state !== undefined && Object.prototype.hasOwnProperty.call(state, key)) {
		return (state[key] ?? null) as TURLSyncState[TKey];
	}
	return fallback;
}

function buildURLFromState(state: TURLSyncState): string {
	const params = new URLSearchParams();
	if (state.gpsFilter !== GPS_FILTER_DEFAULT) {
		params.set(URL_PARAM_GPS_FILTER, state.gpsFilter);
	}
	if (state.hiddenFilter !== HIDDEN_FILTER_DEFAULT) {
		params.set(URL_PARAM_HIDDEN_FILTER, state.hiddenFilter);
	}
	if (state.viewMode !== VIEW_MODE_DEFAULT) {
		params.set(URL_PARAM_VIEW_MODE, state.viewMode);
	}
	if (state.selectedAlbumID) {
		const sanitizedAlbumID = sanitizeAlbumID(state.selectedAlbumID);
		if (sanitizedAlbumID) {
			params.set(URL_PARAM_ALBUM_ID, sanitizedAlbumID);
		}
	}
	if (state.selectedTagID) {
		const sanitizedTagID = sanitizeAlbumID(state.selectedTagID);
		if (sanitizedTagID) {
			params.set(URL_PARAM_TAG_ID, sanitizedTagID);
		}
	}
	if (state.pageSize !== DEFAULT_PAGE_SIZE) {
		params.set(URL_PARAM_PAGE_SIZE, String(state.pageSize));
	}
	if (state.gridColumns !== DEFAULT_GRID_COLUMNS) {
		params.set(URL_PARAM_GRID_COLUMNS, String(state.gridColumns));
	}
	if (state.visibleMarkerLimit !== DEFAULT_VISIBLE_MARKER_LIMIT) {
		params.set(URL_PARAM_MARKER_LIMIT, String(state.visibleMarkerLimit));
	}
	if (state.startDate) {
		params.set(URL_PARAM_START_DATE, state.startDate);
	}
	if (state.endDate) {
		params.set(URL_PARAM_END_DATE, state.endDate);
	}
	const query = params.toString();
	if (!query) {
		return '';
	}
	return `?${query}`;
}

type TURLStateSetters = {
	setGPSFilter: (filter: TGPSFilter) => void;
	setHiddenFilter: (filter: THiddenFilter) => void;
	setViewMode: (mode: TViewMode) => void;
	setSelectedAlbumID: (albumID: string | null) => void;
	setSelectedTagID: (tagID: string | null) => void;
	setPageSize: (size: number) => void;
	setGridColumns: (cols: number) => void;
	setVisibleMarkerLimit: (limit: number) => void;
	setStartDate: (date: string | null) => void;
	setEndDate: (date: string | null) => void;
};

function applyURLToState(search: string, setters: TURLStateSetters): void {
	if (typeof window === 'undefined') {
		return;
	}

	const params = new URLSearchParams(search);
	setters.setGPSFilter(parseGPSFilter(params.get(URL_PARAM_GPS_FILTER)));
	setters.setHiddenFilter(parseHiddenFilter(params.get(URL_PARAM_HIDDEN_FILTER)));

	const urlView = params.get(URL_PARAM_VIEW_MODE);
	if (urlView === 'timeline' || urlView === 'album') {
		setters.setViewMode(urlView);
	} else {
		setters.setViewMode(VIEW_MODE_DEFAULT);
	}

	setters.setSelectedAlbumID(sanitizeAlbumID(params.get(URL_PARAM_ALBUM_ID)));
	setters.setSelectedTagID(sanitizeAlbumID(params.get(URL_PARAM_TAG_ID)));
	setters.setPageSize(normalizePageParam(params.get(URL_PARAM_PAGE_SIZE), DEFAULT_PAGE_SIZE, ALLOWED_PAGE_SIZES));
	setters.setGridColumns(
		normalizePageParam(params.get(URL_PARAM_GRID_COLUMNS), DEFAULT_GRID_COLUMNS, ALLOWED_GRID_COLUMNS)
	);
	setters.setVisibleMarkerLimit(normalizeVisibleMarkerLimitParam(params.get(URL_PARAM_MARKER_LIMIT)));
	setters.setStartDate(parseURLDate(params.get(URL_PARAM_START_DATE)));
	setters.setEndDate(parseURLDate(params.get(URL_PARAM_END_DATE)));
}

export function useURLState(): TURLState {
	const urlSync = useMemo(() => createBrowserURLSync(), []);
	const [gpsFilter, setGPSFilterState] = useState<TGPSFilter>(GPS_FILTER_DEFAULT);
	const [hiddenFilter, setHiddenFilterState] = useState<THiddenFilter>(HIDDEN_FILTER_DEFAULT);
	const [pageSize, setPageSizeState] = useState(DEFAULT_PAGE_SIZE);
	const [gridColumns, setGridColumnsState] = useState(DEFAULT_GRID_COLUMNS);
	const [visibleMarkerLimit, setVisibleMarkerLimitState] = useState(DEFAULT_VISIBLE_MARKER_LIMIT);
	const [viewMode, setViewModeState] = useState<TViewMode>(VIEW_MODE_DEFAULT);
	const [selectedAlbumID, setSelectedAlbumIDState] = useState<string | null>(null);
	const [selectedTagID, setSelectedTagIDState] = useState<string | null>(null);
	const [startDate, setStartDateState] = useState<string | null>(null);
	const [endDate, setEndDateState] = useState<string | null>(null);

	const liveStateRef = useRef<TURLSyncState>({
		gpsFilter: GPS_FILTER_DEFAULT,
		hiddenFilter: HIDDEN_FILTER_DEFAULT,
		viewMode: VIEW_MODE_DEFAULT,
		selectedAlbumID: null,
		selectedTagID: null,
		pageSize: DEFAULT_PAGE_SIZE,
		gridColumns: DEFAULT_GRID_COLUMNS,
		visibleMarkerLimit: DEFAULT_VISIBLE_MARKER_LIMIT,
		startDate: null,
		endDate: null
	});

	const setGPSFilterRawAction = useCallback((value: TGPSFilter) => {
		liveStateRef.current.gpsFilter = value;
		setGPSFilterState(value);
	}, []);
	const setHiddenFilterRawAction = useCallback((value: THiddenFilter) => {
		liveStateRef.current.hiddenFilter = value;
		setHiddenFilterState(value);
	}, []);
	const setPageSizeAction = useCallback((value: number) => {
		liveStateRef.current.pageSize = value;
		setPageSizeState(value);
	}, []);
	const setGridColumnsAction = useCallback((value: number) => {
		liveStateRef.current.gridColumns = value;
		setGridColumnsState(value);
	}, []);
	const setVisibleMarkerLimitAction = useCallback((value: number) => {
		liveStateRef.current.visibleMarkerLimit = value;
		setVisibleMarkerLimitState(value);
	}, []);
	const setViewModeAction = useCallback((value: TViewMode) => {
		liveStateRef.current.viewMode = value;
		setViewModeState(value);
	}, []);
	const setSelectedAlbumIDAction = useCallback((value: string | null) => {
		liveStateRef.current.selectedAlbumID = value;
		setSelectedAlbumIDState(value);
	}, []);
	const setSelectedTagIDAction = useCallback((value: string | null) => {
		liveStateRef.current.selectedTagID = value;
		setSelectedTagIDState(value);
	}, []);
	const setStartDateAction = useCallback((value: string | null) => {
		liveStateRef.current.startDate = value;
		setStartDateState(value);
	}, []);
	const setEndDateAction = useCallback((value: string | null) => {
		liveStateRef.current.endDate = value;
		setEndDateState(value);
	}, []);

	const buildURL = useCallback((state?: Partial<TURLSyncState>) => {
		const live = liveStateRef.current;
		const nextState: TURLSyncState = {
			gpsFilter: state?.gpsFilter ?? live.gpsFilter,
			hiddenFilter: state?.hiddenFilter ?? live.hiddenFilter,
			viewMode: state?.viewMode ?? live.viewMode,
			selectedAlbumID: resolveNullableOverride(state, 'selectedAlbumID', live.selectedAlbumID),
			selectedTagID: resolveNullableOverride(state, 'selectedTagID', live.selectedTagID),
			pageSize: state?.pageSize ?? live.pageSize,
			gridColumns: state?.gridColumns ?? live.gridColumns,
			visibleMarkerLimit: state?.visibleMarkerLimit ?? live.visibleMarkerLimit,
			startDate: resolveNullableOverride(state, 'startDate', live.startDate),
			endDate: resolveNullableOverride(state, 'endDate', live.endDate)
		};
		return buildURLFromState(nextState);
	}, []);

	const syncURLAction = useCallback(
		(state?: Partial<TURLSyncState>) => {
			if (!urlSync) {
				return;
			}
			const nextSearch = buildURL(state);
			const fullPath = `${urlSync.readPathname()}${nextSearch}`;
			urlSync.replacePath(fullPath);
		},
		[urlSync, buildURL]
	);

	useEffect(() => {
		if (!urlSync) {
			return;
		}
		const readSearch = urlSync.readSearch;
		const setters: TURLStateSetters = {
			setGPSFilter: setGPSFilterRawAction,
			setHiddenFilter: setHiddenFilterRawAction,
			setViewMode: setViewModeAction,
			setSelectedAlbumID: setSelectedAlbumIDAction,
			setSelectedTagID: setSelectedTagIDAction,
			setPageSize: setPageSizeAction,
			setGridColumns: setGridColumnsAction,
			setVisibleMarkerLimit: setVisibleMarkerLimitAction,
			setStartDate: setStartDateAction,
			setEndDate: setEndDateAction
		};
		applyURLToState(readSearch(), setters);

		function handlePopstate(): void {
			applyURLToState(readSearch(), setters);
		}

		const removeListener = urlSync.subscribePopstate(handlePopstate);
		return () => {
			removeListener();
		};
	}, [
		urlSync,
		setGPSFilterRawAction,
		setHiddenFilterRawAction,
		setViewModeAction,
		setSelectedAlbumIDAction,
		setSelectedTagIDAction,
		setPageSizeAction,
		setGridColumnsAction,
		setVisibleMarkerLimitAction,
		setStartDateAction,
		setEndDateAction
	]);

	return {
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
		selectedTagID,
		setSelectedTagIDAction,
		startDate,
		setStartDateAction,
		endDate,
		setEndDateAction,
		buildURL,
		syncURLAction
	};
}
