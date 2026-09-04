'use client';

import {createContext, useContext} from 'react';

import {TILE_URL} from '@/features/map/constant';

import type {TTileConfigProviderProps} from '@/types/tileConfig';
import type {ReactElement} from 'react';

/**
 * Street basemap tile URL, carrying the CARTO API key when one is configured.
 */
const TileConfigContext = createContext<string>(TILE_URL);

/**
 * Appends the CARTO API key to the street basemap tile URL.
 *
 * CARTO watermarks unauthenticated raster tiles with "API KEY REQUIRED", so the key is
 * passed as the `key` query parameter when configured.
 *
 * @param cartoAPIKey - CARTO basemap API key, empty when unconfigured.
 * @returns Tile URL template handed to Leaflet.
 */
function buildStreetTileURL(cartoAPIKey: string): string {
	if (!cartoAPIKey) {
		return TILE_URL;
	}
	return `${TILE_URL}?key=${encodeURIComponent(cartoAPIKey)}`;
}

/**
 * Shares the street basemap tile URL with every map in the tree.
 *
 * @param props - CARTO API key resolved on the server and the child tree.
 * @returns Provider element exposing the street tile URL.
 */
export function TileConfigProvider({cartoAPIKey, children}: TTileConfigProviderProps): ReactElement {
	const streetTileURL = buildStreetTileURL(cartoAPIKey);

	return <TileConfigContext.Provider value={streetTileURL}>{children}</TileConfigContext.Provider>;
}

/**
 * Returns the street basemap tile URL for the current configuration.
 *
 * @returns Tile URL template, with the CARTO API key appended when configured.
 */
export function useStreetTileURL(): string {
	return useContext(TileConfigContext);
}
