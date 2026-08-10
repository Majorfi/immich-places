'use client';

import L from 'leaflet';
import {useEffect, useRef} from 'react';

import {
	MAP_DEFAULT_CENTER,
	MAP_DEFAULT_ZOOM,
	MAP_FIT_DEFAULT_MAX_ZOOM,
	MAP_FIT_NEARBY_MAX_ZOOM,
	MAP_FIT_NEARBY_SPREAD_THRESHOLD,
	MAP_FIT_PADDING,
	MAP_FIT_SAME_SPOT_MAX_ZOOM,
	MAP_FIT_SAME_SPOT_SPREAD_THRESHOLD,
	MAP_FLY_DURATION_SECONDS
} from '@/utils/map';
import {doesGPSFilterIncludeLocations} from '@/utils/view';

import type {TGPSFilter, TMapMarker} from '@/shared/types/map';
import type {TViewMode} from '@/shared/types/view';
import type {RefObject} from 'react';

type TUseMapAutoFitArgs = {
	mapInstanceRef: RefObject<L.Map | null>;
	programmaticMoveRef: RefObject<boolean>;
	gpsFilter: TGPSFilter;
	viewMode: TViewMode;
	albumFilter: string | null;
	tagFilter: string | null;
	startDate: string | null;
	endDate: string | null;
	mapMarkers: TMapMarker[];
	fittedBoundsKeyRef: RefObject<string | null>;
	prevFitAlbumRef: RefObject<string | null>;
};

/**
 * Computes whether auto-fit should happen for current map/filter state.
 *
 * @param viewMode - Active view mode.
 * @param gpsFilter - Active GPS filter.
 * @param albumFilter - Active album filter ID or null.
 * @param mapMarkersLength - Number of markers currently visible.
 * @returns Cache key for auto-fit scenario or `null` when no fit is needed.
 */
function resolveAutoFitKey(
	viewMode: TViewMode,
	gpsFilter: TGPSFilter,
	albumFilter: string | null,
	mapMarkersLength: number
): string | null {
	if (viewMode === 'album' && !albumFilter) {
		return null;
	}
	if (!doesGPSFilterIncludeLocations(gpsFilter) && !albumFilter) {
		return null;
	}
	if (mapMarkersLength === 0) {
		return null;
	}
	return albumFilter ? `album:${albumFilter}` : 'all';
}

function resolveAutoFitMaxZoom(boundsSpread: number): number {
	if (boundsSpread < MAP_FIT_SAME_SPOT_SPREAD_THRESHOLD) {
		return MAP_FIT_SAME_SPOT_MAX_ZOOM;
	}
	if (boundsSpread < MAP_FIT_NEARBY_SPREAD_THRESHOLD) {
		return MAP_FIT_NEARBY_MAX_ZOOM;
	}
	return MAP_FIT_DEFAULT_MAX_ZOOM;
}

/**
 * Automatically fits map viewport to map markers when relevant inputs change.
 *
 * @param args - Auto-fit configuration and refs.
 */
export function useMapAutoFit({
	mapInstanceRef,
	programmaticMoveRef,
	gpsFilter,
	viewMode,
	albumFilter,
	tagFilter,
	startDate,
	endDate,
	mapMarkers,
	fittedBoundsKeyRef,
	prevFitAlbumRef
}: TUseMapAutoFitArgs): void {
	const prevFitTagRef = useRef(tagFilter);
	const prevFitStartRef = useRef(startDate);
	const prevFitEndRef = useRef(endDate);

	useEffect(() => {
		if (!mapInstanceRef.current) {
			return;
		}
		const map = mapInstanceRef.current;

		const hasAlbumChanged = prevFitAlbumRef.current !== albumFilter;
		const hasTagChanged = prevFitTagRef.current !== tagFilter;
		const hasDateChanged = prevFitStartRef.current !== startDate || prevFitEndRef.current !== endDate;
		prevFitAlbumRef.current = albumFilter;
		prevFitTagRef.current = tagFilter;
		prevFitStartRef.current = startDate;
		prevFitEndRef.current = endDate;

		// On any filter change the marker set is reloading; defer the fit to the next
		// render (when fresh markers have arrived) so we never fit against stale pins.
		if (hasAlbumChanged || hasTagChanged || hasDateChanged) {
			fittedBoundsKeyRef.current = null;
			if (hasAlbumChanged && !albumFilter) {
				programmaticMoveRef.current = true;
				map.flyTo(MAP_DEFAULT_CENTER, MAP_DEFAULT_ZOOM, {duration: MAP_FLY_DURATION_SECONDS});
			}
			return;
		}

		const boundsKey = resolveAutoFitKey(viewMode, gpsFilter, albumFilter, mapMarkers.length);
		if (!boundsKey) {
			return;
		}
		if (fittedBoundsKeyRef.current === boundsKey) {
			return;
		}
		fittedBoundsKeyRef.current = boundsKey;

		const bounds = L.latLngBounds(mapMarkers.map(m => L.latLng(m.latitude, m.longitude)));
		if (!bounds.isValid()) {
			return;
		}

		const boundsSpread = Math.max(bounds.getNorth() - bounds.getSouth(), bounds.getEast() - bounds.getWest());
		const maxZoom = resolveAutoFitMaxZoom(boundsSpread);
		programmaticMoveRef.current = true;
		map.flyToBounds(bounds, {padding: MAP_FIT_PADDING, maxZoom, duration: MAP_FLY_DURATION_SECONDS});
	}, [
		albumFilter,
		tagFilter,
		startDate,
		endDate,
		fittedBoundsKeyRef,
		gpsFilter,
		mapInstanceRef,
		mapMarkers,
		prevFitAlbumRef,
		programmaticMoveRef,
		viewMode
	]);
}
