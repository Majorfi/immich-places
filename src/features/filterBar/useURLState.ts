'use client';

import {useCallback, useEffect, useMemo, useState} from 'react';

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
	URL_PARAM_GPS_FILTER,
	URL_PARAM_GRID_COLUMNS,
	URL_PARAM_HIDDEN_FILTER,
	URL_PARAM_MARKER_LIMIT,
	URL_PARAM_PAGE_SIZE,
	URL_PARAM_VIEW_MODE,
	VIEW_MODE_DEFAULT,
	clampVisibleMarkerLimit
} from '@/utils/view';

import type {TGPSFilter, THiddenFilter} from '@/shared/types/map';
import type {TViewMode} from '@/shared/types/view';

/**
 * URL-backed filter state managed by the filter bar.
 */
type TURLSyncState = {
	gpsFilter: TGPSFilter;
	hiddenFilter: THiddenFilter;
	viewMode: TViewMode;
	selectedAlbumID: string | null;
	pageSize: number;
	gridColumns: number;
	visibleMarkerLimit: number;
};

/**
 * Public return contract for URL-backed filter state hook.
 */
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
	buildURL: (state?: Partial<TURLSyncState>) => string;
	syncURLAction: (state?: Partial<TURLSyncState>) => void;
};

/**
 * Browser adapter for reading and writing URL-related state.
 */
type TURLSyncEnvironment = {
	readSearch: () => string;
	readPathname: () => string;
	replacePath: (path: string) => void;
	subscribePopstate: (listener: () => void) => () => void;
};

const MAX_ALBUM_ID_LENGTH = 256;

/**
 * Sanitizes and validates album IDs coming from URL parameters.
 *
 * @param albumID - Raw album ID value.
 * @returns A safe album ID string or `null` when invalid.
 */
function sanitizeAlbumID(albumID: string | null): string | null {
	if (!albumID) {
		return null;
	}
	const trimmed = albumID.trim();
	if (!trimmed || trimmed.length > MAX_ALBUM_ID_LENGTH) {
		return null;
	}
	if (/\s/.test(trimmed)) {
		return null;
	}
	for (let i = 0; i < trimmed.length; i += 1) {
		const code = trimmed.charCodeAt(i);
		if ((code >= 0 && code <= 31) || code === 127) {
			return null;
		}
	}
	if (/[^\x20-\x7E]/.test(trimmed)) {
		return null;
	}
	return trimmed;
}

/**
 * Builds a browser URL sync environment or returns null in non-browser runtimes.
 *
 * @returns A sync environment object when `window` is available, otherwise `null`.
 */
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

/**
 * Converts a numeric URL parameter into an allowed value or default.
 *
 * @param value - Raw string value from URLSearchParams.
 * @param defaultsTo - Fallback value when parsing fails.
 * @param allowed - Set of values allowed by the app.
 * @returns Parsed integer or fallback.
 */
function normalizePageParam(value: string | null, defaultsTo: number, allowed: Set<number>): number {
	const parsed = Number.parseInt(value ?? '', 10);
	if (!Number.isFinite(parsed)) {
		return defaultsTo;
	}
	return allowed.has(parsed) ? parsed : defaultsTo;
}

/**
 * Converts a raw URL marker-limit parameter into a valid marker limit.
 *
 * @param value - Raw marker-limit query value.
 * @returns Marker-limit value clamped to supported bounds.
 */
function normalizeVisibleMarkerLimitParam(value: string | null): number {
	const parsed = Number.parseInt(value ?? '', 10);
	if (!Number.isFinite(parsed)) {
		return DEFAULT_VISIBLE_MARKER_LIMIT;
	}
	return clampVisibleMarkerLimit(parsed);
}

/**
 * Parses and validates URL GPS filter parameter.
 *
 * @param value - Candidate GPS filter value.
 * @returns A supported GPS filter value.
 */
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

/**
 * Serializes active filter state into query string format.
 *
 * Omits default-valued params to keep URLs compact.
 *
 * @param state - Full synchronization state.
 * @returns A query string (starting with `?`) or empty string.
 */
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
	if (state.pageSize !== DEFAULT_PAGE_SIZE) {
		params.set(URL_PARAM_PAGE_SIZE, String(state.pageSize));
	}
	if (state.gridColumns !== DEFAULT_GRID_COLUMNS) {
		params.set(URL_PARAM_GRID_COLUMNS, String(state.gridColumns));
	}
	if (state.visibleMarkerLimit !== DEFAULT_VISIBLE_MARKER_LIMIT) {
		params.set(URL_PARAM_MARKER_LIMIT, String(state.visibleMarkerLimit));
	}
	const query = params.toString();
	return query ? `?${query}` : '';
}

/**
 * Reads URL search params and applies values to provided state setters.
 *
 * Falls back to defaults when values are missing or invalid.
 *
 * @param search - The current query string (with or without leading `?`).
 * @param setGPSFilterRawAction - Setter for GPS filter.
 * @param setViewModeAction - Setter for view mode.
 * @param setSelectedAlbumIDAction - Setter for selected album id.
 * @param setPageSizeAction - Setter for page size option.
 * @param setGridColumnsAction - Setter for grid columns option.
 */
function applyURLToState(
	search: string,
	setGPSFilterRawAction: (filter: TGPSFilter) => void,
	setHiddenFilterRawAction: (filter: THiddenFilter) => void,
	setViewModeAction: (mode: TViewMode) => void,
	setSelectedAlbumIDAction: (albumID: string | null) => void,
	setPageSizeAction: (size: number) => void,
	setGridColumnsAction: (cols: number) => void,
	setVisibleMarkerLimitAction: (limit: number) => void
): void {
	if (typeof window === 'undefined') {
		return;
	}

	const params = new URLSearchParams(search);
	const urlGPS = params.get(URL_PARAM_GPS_FILTER);
	setGPSFilterRawAction(parseGPSFilter(urlGPS));
	setHiddenFilterRawAction(parseHiddenFilter(params.get(URL_PARAM_HIDDEN_FILTER)));

	const urlView = params.get(URL_PARAM_VIEW_MODE);
	if (urlView === 'timeline' || urlView === 'album') {
		setViewModeAction(urlView);
	} else {
		setViewModeAction(VIEW_MODE_DEFAULT);
	}

	setSelectedAlbumIDAction(sanitizeAlbumID(params.get(URL_PARAM_ALBUM_ID)));

	const urlPageSize = params.get(URL_PARAM_PAGE_SIZE);
	setPageSizeAction(normalizePageParam(urlPageSize, DEFAULT_PAGE_SIZE, ALLOWED_PAGE_SIZES));

	const urlGridCols = params.get(URL_PARAM_GRID_COLUMNS);
	setGridColumnsAction(normalizePageParam(urlGridCols, DEFAULT_GRID_COLUMNS, ALLOWED_GRID_COLUMNS));

	const urlVisibleMarkerLimit = params.get(URL_PARAM_MARKER_LIMIT);
	setVisibleMarkerLimitAction(normalizeVisibleMarkerLimitParam(urlVisibleMarkerLimit));
}

/**
 * Hook exposing filter state synchronized with URL search params.
 *
 * Provides controlled values and actions for GPS filter, view mode, album id,
 * page size and grid columns, plus URL builders and sync helpers.
 *
 * @returns A state bundle used by the filter and page-level controllers.
 */
export function useURLState(): TURLState {
	const urlSync = useMemo(() => createBrowserURLSync(), []);
	const [gpsFilter, setGPSFilterRawAction] = useState<TGPSFilter>(GPS_FILTER_DEFAULT);
	const [hiddenFilter, setHiddenFilterRawAction] = useState<THiddenFilter>(HIDDEN_FILTER_DEFAULT);
	const [pageSize, setPageSizeAction] = useState(DEFAULT_PAGE_SIZE);
	const [gridColumns, setGridColumnsAction] = useState(DEFAULT_GRID_COLUMNS);
	const [visibleMarkerLimit, setVisibleMarkerLimitAction] = useState(DEFAULT_VISIBLE_MARKER_LIMIT);
	const [viewMode, setViewModeAction] = useState<TViewMode>(VIEW_MODE_DEFAULT);
	const [selectedAlbumID, setSelectedAlbumIDAction] = useState<string | null>(null);

	const buildURL = useCallback(
		(state?: Partial<TURLSyncState>) => {
			const hasSelectedAlbumID =
				state !== undefined && Object.prototype.hasOwnProperty.call(state, 'selectedAlbumID');
			const nextState = {
				gpsFilter: state?.gpsFilter ?? gpsFilter,
				hiddenFilter: state?.hiddenFilter ?? hiddenFilter,
				viewMode: state?.viewMode ?? viewMode,
				selectedAlbumID: hasSelectedAlbumID ? (state.selectedAlbumID ?? null) : selectedAlbumID,
				pageSize: state?.pageSize ?? pageSize,
				gridColumns: state?.gridColumns ?? gridColumns,
				visibleMarkerLimit: state?.visibleMarkerLimit ?? visibleMarkerLimit
			};
			return buildURLFromState(nextState);
		},
		[gpsFilter, hiddenFilter, viewMode, selectedAlbumID, pageSize, gridColumns, visibleMarkerLimit]
	);

	const syncURLAction = useCallback(
		(state?: Partial<TURLSyncState>) => {
			const activeURLSync = urlSync;
			if (!activeURLSync) {
				return;
			}
			const nextSearch = buildURL(state);
			const fullPath = `${activeURLSync.readPathname()}${nextSearch}`;
			activeURLSync.replacePath(fullPath);
		},
		[urlSync, buildURL]
	);

	useEffect(() => {
		const activeURLSync = urlSync;
		if (!activeURLSync) {
			return;
		}
		const readSearch = activeURLSync.readSearch;
		applyURLToState(
			readSearch(),
			setGPSFilterRawAction,
			setHiddenFilterRawAction,
			setViewModeAction,
			setSelectedAlbumIDAction,
			setPageSizeAction,
			setGridColumnsAction,
			setVisibleMarkerLimitAction
		);

		function handlePopstate(): void {
			applyURLToState(
				readSearch(),
				setGPSFilterRawAction,
				setHiddenFilterRawAction,
				setViewModeAction,
				setSelectedAlbumIDAction,
				setPageSizeAction,
				setGridColumnsAction,
				setVisibleMarkerLimitAction
			);
		}

		const removeListener = activeURLSync.subscribePopstate(handlePopstate);
		return () => {
			removeListener();
		};
	}, [urlSync]);

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
		buildURL,
		syncURLAction
	};
}
