'use client';

import {useCallback, useEffect, useRef, useState} from 'react';

import {isAuthErrorWithCode} from '@/features/auth/authApi';
import {useAuth} from '@/features/auth/AuthContext';
import {fetchMapMarkers} from '@/shared/services/backendApi';
import {MAP_BOUNDS_KEY_DECIMALS} from '@/utils/map';
import {DEFAULT_VISIBLE_MARKER_LIMIT} from '@/utils/view';

import type {TViewportBounds} from '@/shared/types/api';
import type {TMapMarker, TMediaFilter} from '@/shared/types/map';

type TUseMapMarkersReturn = {
	mapMarkers: TMapMarker[];
	error: string | null;
};

/**
 * Builds a stable cache key from viewport bounds for deduplicating map requests.
 *
 * @param bounds - Optional viewport bounds.
 * @returns Normalized key string.
 */
function boundsKey(bounds?: TViewportBounds | null): string {
	if (!bounds) {
		return '';
	}
	return `${bounds.north.toFixed(MAP_BOUNDS_KEY_DECIMALS)}:${bounds.south.toFixed(MAP_BOUNDS_KEY_DECIMALS)}:${bounds.east.toFixed(MAP_BOUNDS_KEY_DECIMALS)}:${bounds.west.toFixed(MAP_BOUNDS_KEY_DECIMALS)}`;
}

/**
 * Loads map markers by album, version, and bounds.
 *
 * @param albumID - Optional album filter.
 * @param version - Change token triggering a reload.
 * @param bounds - Viewport bounds for server-side filtering.
 * @returns Map marker list and any fetch error.
 */
export function useMapMarkers(
	mediaFilter: TMediaFilter,
	albumID?: string | null,
	tagID?: string | null,
	startDate?: string | null,
	endDate?: string | null,
	version = 0,
	bounds?: TViewportBounds | null,
	visibleMarkerLimit: number = DEFAULT_VISIBLE_MARKER_LIMIT
): TUseMapMarkersReturn {
	const [mapMarkers, setMapMarkers] = useState<TMapMarker[]>([]);
	const [error, setError] = useState<string | null>(null);
	const {logout} = useAuth();
	const requestIDRef = useRef(0);
	const abortRef = useRef<AbortController | null>(null);
	let effectiveBounds = bounds ?? null;
	if (albumID) {
		effectiveBounds = null;
	}
	const currentBoundsKey = boundsKey(effectiveBounds);

	const load = useCallback(
		async (
			currentMediaFilter: TMediaFilter,
			currentAlbumID?: string,
			currentTagID?: string,
			currentStartDate?: string,
			currentEndDate?: string,
			currentBounds?: TViewportBounds | null,
			currentVisibleMarkerLimit: number = DEFAULT_VISIBLE_MARKER_LIMIT
		) => {
			requestIDRef.current += 1;
			const requestID = requestIDRef.current;
			abortRef.current?.abort();
			const controller = new AbortController();
			abortRef.current = controller;
			try {
				const markers = await fetchMapMarkers(
					currentMediaFilter,
					currentAlbumID,
					currentTagID,
					currentStartDate,
					currentEndDate,
					currentBounds,
					currentVisibleMarkerLimit,
					{signal: controller.signal}
				);
				if (requestIDRef.current !== requestID) {
					return;
				}
				setMapMarkers(markers);
				setError(null);
			} catch (error) {
				if (controller.signal.aborted) {
					return;
				}
				if (requestIDRef.current !== requestID) {
					return;
				}
				if (isAuthErrorWithCode(error, 'notAuthenticated')) {
					void logout();
					return;
				}
				setError('Failed to refresh map markers.');
			}
		},
		[logout]
	);

	const prevMediaFilter = useRef(mediaFilter);
	const prevAlbumID = useRef(albumID);
	const prevTagID = useRef(tagID);
	const prevStartDate = useRef(startDate);
	const prevEndDate = useRef(endDate);
	const prevVersion = useRef(version);
	const prevBoundsKey = useRef(currentBoundsKey);
	const prevVisibleMarkerLimit = useRef(visibleMarkerLimit);
	const hasLoadedRef = useRef(false);

	useEffect(() => {
		const isMediaFilterChanged = prevMediaFilter.current !== mediaFilter;
		const isAlbumChanged = prevAlbumID.current !== albumID;
		const isTagChanged = prevTagID.current !== tagID;
		const isStartDateChanged = prevStartDate.current !== startDate;
		const isEndDateChanged = prevEndDate.current !== endDate;
		const isVersionChanged = prevVersion.current !== version;
		const isBoundsChanged = prevBoundsKey.current !== currentBoundsKey;
		const isVisibleMarkerLimitChanged = prevVisibleMarkerLimit.current !== visibleMarkerLimit;

		prevMediaFilter.current = mediaFilter;
		prevAlbumID.current = albumID;
		prevTagID.current = tagID;
		prevStartDate.current = startDate;
		prevEndDate.current = endDate;
		prevVersion.current = version;
		prevBoundsKey.current = currentBoundsKey;
		prevVisibleMarkerLimit.current = visibleMarkerLimit;

		if (!albumID && !tagID && !effectiveBounds) {
			return;
		}

		if (
			isMediaFilterChanged ||
			isAlbumChanged ||
			isTagChanged ||
			isStartDateChanged ||
			isEndDateChanged ||
			isVersionChanged ||
			isBoundsChanged ||
			isVisibleMarkerLimitChanged ||
			!hasLoadedRef.current
		) {
			hasLoadedRef.current = true;
			if (isMediaFilterChanged || isAlbumChanged || isTagChanged || isStartDateChanged || isEndDateChanged) {
				setMapMarkers([]);
				setError(null);
				load(
					mediaFilter,
					albumID ?? undefined,
					tagID ?? undefined,
					startDate ?? undefined,
					endDate ?? undefined,
					effectiveBounds,
					visibleMarkerLimit
				);
				return;
			}
			load(
				mediaFilter,
				albumID ?? undefined,
				tagID ?? undefined,
				startDate ?? undefined,
				endDate ?? undefined,
				effectiveBounds,
				visibleMarkerLimit
			);
		}
	}, [
		mediaFilter,
		albumID,
		tagID,
		startDate,
		endDate,
		effectiveBounds,
		currentBoundsKey,
		load,
		version,
		visibleMarkerLimit
	]);

	useEffect(() => {
		return () => {
			abortRef.current?.abort();
			hasLoadedRef.current = false;
		};
	}, []);

	return {mapMarkers, error};
}
