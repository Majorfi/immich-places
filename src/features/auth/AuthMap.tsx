'use client';

import L from 'leaflet';
import {useEffect, useRef} from 'react';

import {TILE_ATTRIBUTION} from '@/features/map/constant';
import {useStreetTileURL} from '@/features/map/TileConfigContext';
import {MAP_DEFAULT_CENTER, MAP_DEFAULT_ZOOM, MAP_TILE_MAX_ZOOM} from '@/utils/map';

import type {ReactElement} from 'react';

/**
 * Authentication background map rendered during user authentication.
 *
 * Creates and manages a Leaflet map instance for the auth area and guarantees
 * cleanup when the component unmounts.
 */
export function AuthMap(): ReactElement {
	const containerRef = useRef<HTMLDivElement>(null);
	const mapRef = useRef<L.Map | null>(null);
	const streetTileURL = useStreetTileURL();

	useEffect(() => {
		if (!containerRef.current || mapRef.current) {
			return;
		}

		const map = L.map(containerRef.current, {
			attributionControl: false,
			zoomControl: false
		}).setView(MAP_DEFAULT_CENTER, MAP_DEFAULT_ZOOM);

		L.control.attribution({prefix: false}).addTo(map);
		L.tileLayer(streetTileURL, {attribution: TILE_ATTRIBUTION, maxZoom: MAP_TILE_MAX_ZOOM}).addTo(map);
		mapRef.current = map;

		const frame = requestAnimationFrame(() => {
			const currentMap = mapRef.current;
			if (!currentMap) {
				return;
			}
			currentMap.invalidateSize();
		});

		return () => {
			const currentMap = mapRef.current;
			if (!currentMap) {
				return;
			}
			cancelAnimationFrame(frame);
			currentMap.remove();
			mapRef.current = null;
		};
	}, [streetTileURL]);

	return (
		<div
			ref={containerRef}
			className={'h-full w-full'}
		/>
	);
}
