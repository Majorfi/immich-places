import {normalizePositiveInteger} from '@/utils/math';

import type {TGPSFilter, THiddenFilter} from '@/shared/types/map';
import type {TViewMode} from '@/shared/types/view';

export const VIEW_MODE_DEFAULT: TViewMode = 'album';
export const GPS_FILTER_WITH_GPS: TGPSFilter = 'with-gps';
export const GPS_FILTER_DEFAULT: TGPSFilter = GPS_FILTER_WITH_GPS;
export const GPS_FILTER_NO_GPS: TGPSFilter = 'no-gps';
export const HIDDEN_FILTER_DEFAULT: THiddenFilter = 'visible';
export const URL_PARAM_HIDDEN_FILTER = 'hidden';

export const DEFAULT_PAGE_SIZE = 90;
export const DEFAULT_GRID_COLUMNS = 3;
export const DEFAULT_VISIBLE_MARKER_LIMIT = 10000;
const VISIBLE_MARKER_LIMIT_MIN = 1000;
const VISIBLE_MARKER_LIMIT_MAX = 100000;
const VISIBLE_MARKER_LIMIT_INCREMENT = 1000;

export const PAGE_SIZE_ALL = 10000;
export const PAGE_SIZE_OPTIONS = [60, 90, 120, PAGE_SIZE_ALL] as const;
export const GRID_COLUMN_OPTIONS = [1, 2, 3, 4] as const;

export const URL_PARAM_GPS_FILTER = 'gps';
export const URL_PARAM_VIEW_MODE = 'view';
export const URL_PARAM_ALBUM_ID = 'album';
export const URL_PARAM_TAG_ID = 'tag';
export const URL_PARAM_PAGE_SIZE = 'pageSize';
export const URL_PARAM_GRID_COLUMNS = 'gridCols';
export const URL_PARAM_MARKER_LIMIT = 'markerLimit';
export const URL_PARAM_START_DATE = 'startDate';
export const URL_PARAM_END_DATE = 'endDate';

export function isGPSFilterWithLocations(gpsFilter: TGPSFilter): boolean {
	return gpsFilter === GPS_FILTER_WITH_GPS;
}

export function isGPSFilterWithoutLocations(gpsFilter: TGPSFilter): boolean {
	return gpsFilter === GPS_FILTER_NO_GPS;
}

export function normalizePageSize(value: number, fallback: number): number {
	return normalizePositiveInteger(value, fallback);
}

export function clampVisibleMarkerLimit(value: number): number {
	const normalized = Math.trunc(value);
	if (!Number.isFinite(normalized)) {
		return DEFAULT_VISIBLE_MARKER_LIMIT;
	}
	if (normalized < VISIBLE_MARKER_LIMIT_MIN) {
		return VISIBLE_MARKER_LIMIT_MIN;
	}
	if (normalized > VISIBLE_MARKER_LIMIT_MAX) {
		return VISIBLE_MARKER_LIMIT_MAX;
	}
	return normalized;
}

export function buildVisibleMarkerLimitOptions(visibleMarkerTotalCount: number): number[] {
	let cappedTotal = visibleMarkerTotalCount;
	if (cappedTotal > VISIBLE_MARKER_LIMIT_MAX) {
		cappedTotal = VISIBLE_MARKER_LIMIT_MAX;
	}
	if (cappedTotal < VISIBLE_MARKER_LIMIT_MIN) {
		return [];
	}

	const options: number[] = [];
	let currentOption = VISIBLE_MARKER_LIMIT_MIN;
	for (; currentOption < cappedTotal; currentOption += VISIBLE_MARKER_LIMIT_INCREMENT) {
		options.push(currentOption);
	}
	options.push(cappedTotal);
	return options;
}

export function resolveActiveVisibleMarkerLimit(visibleMarkerLimit: number, options: readonly number[]): number {
	if (options.length === 0) {
		return visibleMarkerLimit;
	}
	let activeOption = options[0];
	for (const option of options) {
		if (visibleMarkerLimit >= option) {
			activeOption = option;
		}
	}
	return activeOption;
}

export function formatMarkerLimitOption(value: number): string {
	if (value % 1000 === 0) {
		return `${value / 1000}k`;
	}
	return value.toLocaleString();
}
