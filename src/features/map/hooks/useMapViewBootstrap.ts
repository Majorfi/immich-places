'use client';

import L from 'leaflet';
import {useEffect} from 'react';

import {TILE_ATTRIBUTION, TILE_URL} from '@/features/map/constants';
import {
	MAP_BOUNDS_DEBOUNCE_MS,
	MAP_BOUNDS_KEY_DECIMALS,
	MAP_DEFAULT_CENTER,
	MAP_DEFAULT_ZOOM,
	MAP_INITIAL_BOUNDS_SYNC_DELAY_MS,
	MAP_TILE_MAX_ZOOM
} from '@/utils/map';

import type {TViewportBounds} from '@/shared/types/api';
import type {RefObject} from 'react';

/**
 * Serializes map bounds for moveend synchronization and deduping.
 *
 * @param bounds - Leaflet bounds object.
 * @returns Rounded viewport bounds payload.
 */
function toTViewportBounds(bounds: L.LatLngBounds): TViewportBounds {
	const roundValue = (value: number): number => Number(value.toFixed(MAP_BOUNDS_KEY_DECIMALS));
	return {
		north: roundValue(bounds.getNorth()),
		south: roundValue(bounds.getSouth()),
		east: roundValue(bounds.getEast()),
		west: roundValue(bounds.getWest())
	};
}

function viewportBoundsKey(bounds: TViewportBounds): string {
	return `${bounds.north}:${bounds.south}:${bounds.east}:${bounds.west}`;
}

type TUseMapBootstrapArgs = {
	containerRef: RefObject<HTMLDivElement | null>;
	mapInstanceRef: RefObject<L.Map | null>;
	tileLayerRef: RefObject<L.TileLayer | null>;
	boundsDebounceRef: RefObject<ReturnType<typeof setTimeout> | null>;
	boundsKeyRef: RefObject<string>;
	programmaticMoveRef: RefObject<boolean>;
	setMapBoundsAction: (bounds: TViewportBounds) => void;
	clearLocationAction: (clearPendingOnly?: boolean) => void;
};

/**
 * Creates and mounts a Leaflet map, and keeps viewport bounds synced after movement.
 *
 * @param args - Bootstrap inputs.
 */
export function useMapBootstrap({
	containerRef,
	mapInstanceRef,
	tileLayerRef,
	boundsDebounceRef,
	boundsKeyRef,
	programmaticMoveRef,
	setMapBoundsAction,
	clearLocationAction
}: TUseMapBootstrapArgs): void {
	useEffect(() => {
		if (!containerRef.current || mapInstanceRef.current) {
			return;
		}

		const map = L.map(containerRef.current, {attributionControl: false, zoomControl: false}).setView(
			MAP_DEFAULT_CENTER,
			MAP_DEFAULT_ZOOM
		);
		L.control.attribution({prefix: false}).addTo(map);
		const tiles = L.tileLayer(TILE_URL, {attribution: TILE_ATTRIBUTION, maxZoom: MAP_TILE_MAX_ZOOM}).addTo(map);
		tileLayerRef.current = tiles;
		mapInstanceRef.current = map;

		requestAnimationFrame(() => {
			map.invalidateSize();
		});

		const initialBounds = toTViewportBounds(map.getBounds());
		boundsKeyRef.current = viewportBoundsKey(initialBounds);
		let initialSyncTimer: ReturnType<typeof setTimeout> | null = null;
		tiles.once('load', () => {
			initialSyncTimer = setTimeout(() => setMapBoundsAction(initialBounds), MAP_INITIAL_BOUNDS_SYNC_DELAY_MS);
		});

		return () => {
			if (initialSyncTimer) {
				clearTimeout(initialSyncTimer);
				initialSyncTimer = null;
			}
			if (boundsDebounceRef.current) {
				clearTimeout(boundsDebounceRef.current);
				boundsDebounceRef.current = null;
			}
			map.remove();
			tileLayerRef.current = null;
			mapInstanceRef.current = null;
		};
	}, [boundsDebounceRef, boundsKeyRef, containerRef, mapInstanceRef, tileLayerRef, setMapBoundsAction]);

	useEffect(() => {
		if (!mapInstanceRef.current) {
			return;
		}
		const map = mapInstanceRef.current;

		function syncMapBounds(): void {
			const bounds = map.getBounds();
			const nextBounds = toTViewportBounds(bounds);
			const nextKey = viewportBoundsKey(nextBounds);
			if (nextKey !== boundsKeyRef.current) {
				if (boundsDebounceRef.current) {
					clearTimeout(boundsDebounceRef.current);
				}
				boundsDebounceRef.current = setTimeout(() => {
					boundsKeyRef.current = nextKey;
					setMapBoundsAction(nextBounds);
				}, MAP_BOUNDS_DEBOUNCE_MS);
			}
		}

		function handleMoveEnd(): void {
			if (programmaticMoveRef.current) {
				programmaticMoveRef.current = false;
			} else {
				clearLocationAction(true);
			}
			syncMapBounds();
		}

		syncMapBounds();
		map.on('moveend', handleMoveEnd);
		return () => {
			map.off('moveend', handleMoveEnd);
			if (boundsDebounceRef.current) {
				clearTimeout(boundsDebounceRef.current);
				boundsDebounceRef.current = null;
			}
		};
	}, [boundsDebounceRef, boundsKeyRef, clearLocationAction, mapInstanceRef, programmaticMoveRef, setMapBoundsAction]);
}
