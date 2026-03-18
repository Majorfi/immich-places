'use client';

import L from 'leaflet';
import {useEffect} from 'react';

import {searchPinIcon} from '@/features/map/icons';
import {
	MAP_FLY_DURATION_SECONDS,
	MAP_LOCATION_SOURCE_GO_TO,
	MAP_LOCATION_SOURCE_MARKER_DRAG,
	MAP_LOCATION_SOURCE_SEARCH,
	MAP_LOCATION_SOURCE_SUGGESTION,
	PENDING_MARKER_NO_SELECTION_MIN_ZOOM,
	PENDING_MARKER_SEARCH_ZOOM,
	PENDING_MARKER_SUGGESTION_ZOOM,
	PENDING_MARKER_Z_INDEX_OFFSET
} from '@/utils/map';

import type {TAssetRow} from '@/shared/types/asset';
import type {TPendingLocation, TSetLocationOptions} from '@/shared/types/map';
import type {RefObject} from 'react';

/**
 * Hook inputs for managing the pending-location marker.
 */
type TUsePendingSelectionMarkerArgs = {
	mapInstanceRef: RefObject<L.Map | null>;
	markerRef: RefObject<L.Marker | null>;
	programmaticMoveRef: RefObject<boolean>;
	pendingLocation: TPendingLocation | null;
	selectedAssets: TAssetRow[];
	setLocationAction: (options: TSetLocationOptions) => void;
	clearLocationAction: (clearPendingOnly?: boolean) => void;
};

/**
 * Removes an existing pending marker instance.
 */
function clearMarker(markerRef: RefObject<L.Marker | null>): void {
	if (!markerRef.current) {
		return;
	}
	markerRef.current.remove();
	markerRef.current = null;
}

/**
 * Creates and attaches a draggable marker for photo selection or search location.
 */
function createDraggableMarker(
	map: L.Map,
	coords: {latitude: number; longitude: number},
	markerRef: RefObject<L.Marker | null>,
	setLocationAction: (options: TSetLocationOptions) => void,
	clearLocationAction: (clearPendingOnly?: boolean) => void
): void {
	markerRef.current = L.marker([coords.latitude, coords.longitude], {
		icon: searchPinIcon(),
		draggable: true,
		zIndexOffset: PENDING_MARKER_Z_INDEX_OFFSET
	}).addTo(map);
	markerRef.current.on('dragend', (event: L.DragEndEvent) => {
		const latlng = (event.target as L.Marker).getLatLng();
		setLocationAction({latitude: latlng.lat, longitude: latlng.lng, source: MAP_LOCATION_SOURCE_MARKER_DRAG});
	});
	markerRef.current.on('click', event => {
		event.originalEvent.preventDefault();
		event.originalEvent.stopPropagation();
		clearLocationAction(true);
	});
}

/**
 * Resolves zoom for a newly placed pending marker based on its source.
 */
function resolvePendingZoom(map: L.Map, source: TPendingLocation['source']): number {
	if (source === MAP_LOCATION_SOURCE_SEARCH || source === MAP_LOCATION_SOURCE_GO_TO) {
		return PENDING_MARKER_SEARCH_ZOOM;
	}
	if (source === MAP_LOCATION_SOURCE_SUGGESTION) {
		return PENDING_MARKER_SUGGESTION_ZOOM;
	}
	return Math.max(map.getZoom(), PENDING_MARKER_NO_SELECTION_MIN_ZOOM);
}

/**
 * Compares an existing marker coordinate with a pending location.
 */
function hasSameLocation(a: L.LatLng | null, b: {latitude: number; longitude: number} | null): boolean {
	if (!a || !b) {
		return false;
	}
	return a.lat === b.latitude && a.lng === b.longitude;
}

/**
 * Checks if coordinates are inside current map bounds.
 */
function isLocationVisible(map: L.Map, latitude: number, longitude: number): boolean {
	const bounds = map.getBounds();
	return bounds.contains([latitude, longitude]);
}

/**
 * Synchronizes a draggable marker to pending location or selected asset fallback.
 *
 * @param args - Current map ref, marker ref and location context.
 */
export function usePendingSelectionMarker({
	mapInstanceRef,
	markerRef,
	programmaticMoveRef,
	pendingLocation,
	selectedAssets,
	setLocationAction,
	clearLocationAction
}: TUsePendingSelectionMarkerArgs): void {
	useEffect(() => {
		if (!mapInstanceRef.current) {
			return;
		}
		const map = mapInstanceRef.current;
		const existingMarkerPosition = markerRef.current?.getLatLng() ?? null;
		clearMarker(markerRef);

		if (pendingLocation && pendingLocation.source === MAP_LOCATION_SOURCE_GO_TO) {
			const zoom = resolvePendingZoom(map, pendingLocation.source);
			programmaticMoveRef.current = true;
			map.flyTo([pendingLocation.latitude, pendingLocation.longitude], zoom, {
				duration: MAP_FLY_DURATION_SECONDS
			});
			clearLocationAction(true);
			return;
		}

		if (pendingLocation) {
			if (selectedAssets.length === 0) {
				createDraggableMarker(
					map,
					{latitude: pendingLocation.latitude, longitude: pendingLocation.longitude},
					markerRef,
					setLocationAction,
					clearLocationAction
				);
			}

			const isSamePosition = hasSameLocation(existingMarkerPosition, {
				latitude: pendingLocation.latitude,
				longitude: pendingLocation.longitude
			});
			const shouldFlyTo =
				pendingLocation.source === MAP_LOCATION_SOURCE_SEARCH ||
				pendingLocation.source === MAP_LOCATION_SOURCE_SUGGESTION ||
				!isSamePosition;
			if (!shouldFlyTo) {
				return;
			}
			if (
				!isLocationVisible(map, pendingLocation.latitude, pendingLocation.longitude) ||
				pendingLocation.source === MAP_LOCATION_SOURCE_SEARCH ||
				pendingLocation.source === MAP_LOCATION_SOURCE_SUGGESTION
			) {
				const zoom = resolvePendingZoom(map, pendingLocation.source);
				programmaticMoveRef.current = true;
				map.flyTo([pendingLocation.latitude, pendingLocation.longitude], zoom, {
					duration: MAP_FLY_DURATION_SECONDS
				});
			}
			return;
		}
	}, [
		mapInstanceRef,
		markerRef,
		programmaticMoveRef,
		pendingLocation,
		selectedAssets,
		setLocationAction,
		clearLocationAction
	]);
}
