/**
 * Service API for all application backend requests and URL helpers.
 * This module centralizes endpoint construction, query normalization, and response parsing.
 */
import {backendFetch, parseJSON} from '@/shared/services/backendApi.fetch';
import {
	isAlbumRow,
	isAssetPageInfo,
	isHealthResponse,
	isLibraryRow,
	isMapMarker,
	isPaginatedAssets,
	isSyncStatus,
	isTLocationCluster,
	isTRawSuggestionsResponse,
	isTSuggestionsResponse
} from '@/shared/services/backendApi.guards';
import {getBackendBaseURL} from '@/utils/backendUrls';
import {normalizePositiveInteger} from '@/utils/math';
import {DEFAULT_PAGE_SIZE} from '@/utils/view';

import type {TAlbumRow} from '@/shared/types/album';
import type {TRequestOptions, TViewportBounds} from '@/shared/types/api';
import type {TAssetPageInfo, TPaginatedAssets} from '@/shared/types/asset';
import type {TAuthErrorCode} from '@/shared/types/auth';
import type {THealthResponse} from '@/shared/types/health';
import type {TLibraryRow} from '@/shared/types/library';
import type {TGPSFilter, TMapMarker} from '@/shared/types/map';
import type {TLocationCluster, TSuggestionsResponse} from '@/shared/types/suggestion';

const BASE = getBackendBaseURL();

function normalizeAssetPage(page: number): number {
	return normalizePositiveInteger(page, 1);
}

function normalizePageSize(size: number): number {
	return normalizePositiveInteger(size, DEFAULT_PAGE_SIZE);
}

type TMapMarkerAuthError = Error & {
	code?: TAuthErrorCode;
};

function createMapMarkerAuthError(message: string, code: TAuthErrorCode): TMapMarkerAuthError {
	const error = new Error(message) as TMapMarkerAuthError;
	error.code = code;
	return error;
}

async function readErrorMessage(response: Response): Promise<string | null> {
	try {
		const text = await response.text();
		const parsed = JSON.parse(text);
		return typeof parsed?.error === 'string' ? parsed.error : null;
	} catch {
		return null;
	}
}

function buildSearchParams(entries: Record<string, string | undefined>): URLSearchParams {
	const params = new URLSearchParams();
	Object.entries(entries).forEach(([key, value]) => {
		if (typeof value === 'string' && value.length > 0) {
			params.set(key, value);
		}
	});
	return params;
}

function addIfNumber(params: URLSearchParams, key: string, value: unknown): void {
	if (typeof value === 'number' && Number.isFinite(value)) {
		params.set(key, String(value));
	}
}

/**
 * Checks backend health endpoint and returns the parsed payload.
 *
 * @param opts - Optional request options such as abort signal and timeout override.
 * @returns Current health snapshot from backend.
 * @throws Error when the backend does not return a successful response or payload is invalid.
 */
export async function checkHealth(opts: TRequestOptions = {}): Promise<THealthResponse> {
	const response = await backendFetch(`${BASE}/health`, {}, opts);
	if (!response.ok) {
		throw new Error('Backend not reachable');
	}
	return parseJSON(response, isHealthResponse, 'Invalid health response payload');
}

/**
 * Fetches a paginated list of assets.
 *
 * @param page - Requested page index.
 * @param pageSize - Number of assets per page.
 * @param gpsFilter - Optional GPS filter query string.
 * @param albumID - Optional album id to scope results.
 * @param opts - Optional request options such as abort signal and timeout override.
 * @returns Paginated assets payload for the requested view.
 * @throws Error when the request fails or response payload is invalid.
 */
export async function fetchAssets(
	page: number,
	pageSize: number,
	gpsFilter: TGPSFilter,
	albumID?: string,
	opts: TRequestOptions = {}
): Promise<TPaginatedAssets> {
	const params = buildSearchParams({
		page: String(normalizeAssetPage(page)),
		pageSize: String(normalizePageSize(pageSize)),
		gpsFilter
	});
	if (albumID) {
		params.set('albumID', albumID);
	}
	const url = `${BASE}/assets?${params.toString()}`;
	const response = await backendFetch(url, {}, opts);
	if (!response.ok) {
		throw new Error(`Failed to fetch assets: ${response.status}`);
	}
	return parseJSON(response, isPaginatedAssets, 'Invalid assets response payload');
}

/**
 * Fetches album rows visible for current GPS filter context.
 *
 * @param gpsFilter - Optional GPS filter query string.
 * @param opts - Optional request options such as abort signal and timeout override.
 * @returns Album list payload.
 * @throws Error when the request fails or response payload is invalid.
 */
export async function fetchAlbums(gpsFilter: TGPSFilter, opts: TRequestOptions = {}): Promise<TAlbumRow[]> {
	const params = buildSearchParams({gpsFilter});
	const response = await backendFetch(`${BASE}/albums?${params.toString()}`, {}, opts);
	if (!response.ok) {
		throw new Error(`Failed to fetch albums: ${response.status}`);
	}
	return parseJSON(
		response,
		(value): value is TAlbumRow[] => Array.isArray(value) && value.every(isAlbumRow),
		'Invalid albums response payload'
	);
}

/**
 * Fetches map markers optionally filtered by album and viewport bounds.
 *
 * @param albumID - Optional album id to filter map markers.
 * @param bounds - Optional viewport bounds to reduce marker fetch scope.
 * @param opts - Optional request options such as abort signal and timeout override.
 * @returns Array of map marker objects.
 * @throws Error when the request fails or response payload is invalid.
 */
export async function fetchMapMarkers(
	albumID?: string,
	bounds?: TViewportBounds | null,
	opts: TRequestOptions = {}
): Promise<TMapMarker[]> {
	const params = new URLSearchParams();
	if (albumID) {
		params.set('albumID', albumID);
	}
	if (bounds) {
		addIfNumber(params, 'north', bounds.north);
		addIfNumber(params, 'south', bounds.south);
		addIfNumber(params, 'east', bounds.east);
		addIfNumber(params, 'west', bounds.west);
	}

	let url = `${BASE}/map-markers`;
	if (params.size > 0) {
		url += `?${params.toString()}`;
	}
	const response = await backendFetch(url, {}, opts);
	if (!response.ok) {
		if (response.status === 401) {
			const errorMessage = await readErrorMessage(response);
			if (errorMessage === 'not authenticated' || errorMessage === 'session expired') {
				throw createMapMarkerAuthError('Not authenticated', 'notAuthenticated');
			}
		}
		throw new Error(`Failed to fetch map markers: ${response.status}`);
	}
	return parseJSON(
		response,
		(value): value is TMapMarker[] => Array.isArray(value) && value.every(isMapMarker),
		'Invalid map markers response payload'
	);
}

/**
 * Fetches suggestion clusters for an asset from the backend.
 *
 * @param assetID - Asset identifier for which suggestions are requested.
 * @param albumID - Optional album id to scope suggestions.
 * @param opts - Optional request options such as abort signal and timeout override.
 * @returns Suggestions payload with clustered location data.
 * @throws Error when the request fails or response payload is invalid.
 */
export async function fetchSuggestions(
	assetID: string,
	albumID?: string,
	opts: TRequestOptions = {}
): Promise<TSuggestionsResponse> {
	let url = `${BASE}/assets/${encodeURIComponent(assetID)}/suggestions`;
	if (albumID) {
		const params = buildSearchParams({albumID});
		url += `?${params.toString()}`;
	}
	const response = await backendFetch(url, {}, opts);
	if (!response.ok) {
		throw new Error(`Failed to fetch suggestions: ${response.status}`);
	}

	let payload: unknown;
	try {
		payload = await response.json();
	} catch {
		throw new Error('Invalid suggestions response payload');
	}

	if (!isTRawSuggestionsResponse(payload)) {
		throw new Error('Invalid suggestions response payload');
	}

	const normalized: TSuggestionsResponse = {
		sameDayClusters: payload.sameDayClusters ?? [],
		twoDayClusters: payload.twoDayClusters ?? [],
		weeklyClusters: payload.weeklyClusters ?? [],
		frequentLocations: payload.frequentLocations ?? [],
		albumClusters: payload.albumClusters ?? []
	};

	if (!isTSuggestionsResponse(normalized)) {
		throw new Error('Invalid suggestions response payload');
	}

	return normalized;
}

/**
 * Fetches aggregated frequent location clusters.
 *
 * @param opts - Optional request options such as abort signal and timeout override.
 * @returns Frequent location cluster array.
 * @throws Error when the request fails or payload is invalid.
 */
export async function fetchFrequentLocations(opts: TRequestOptions = {}): Promise<TLocationCluster[]> {
	const response = await backendFetch(`${BASE}/frequent-locations`, {}, opts);
	if (!response.ok) {
		throw new Error(`Failed to fetch frequent locations: ${response.status}`);
	}
	return parseJSON(
		response,
		(value): value is TLocationCluster[] => Array.isArray(value) && value.every(isTLocationCluster),
		'Invalid frequent locations response payload'
	);
}

/**
 * Persists a corrected asset location back to backend storage.
 *
 * @param assetID - Asset identifier to update.
 * @param latitude - Latitude in decimal degrees.
 * @param longitude - Longitude in decimal degrees.
 * @param opts - Optional request options such as abort signal and timeout override.
 * @throws Error when the request fails or backend rejects payload.
 */
export async function saveAssetLocation(
	assetID: string,
	latitude: number,
	longitude: number,
	opts: TRequestOptions = {}
): Promise<void> {
	const response = await backendFetch(
		`${BASE}/assets/${encodeURIComponent(assetID)}/location`,
		{
			method: 'PUT',
			headers: {'Content-Type': 'application/json'}, //eslint-disable-line
			body: JSON.stringify({latitude, longitude})
		},
		opts
	);
	if (!response.ok) {
		const backendMessage = await readErrorMessage(response);
		if (backendMessage) {
			throw new Error(`Failed to save location: ${response.status} - ${backendMessage}`);
		}
		throw new Error(`Failed to save location: ${response.status}`);
	}
}

/**
 * Fetches page metadata for an asset in the current listing context.
 *
 * @param assetID - Asset identifier used to compute page location details.
 * @param pageSize - Requested assets per page for context calculation.
 * @param albumID - Optional album id filter context.
 * @param opts - Optional request options such as abort signal and timeout override.
 * @returns Asset page information response.
 * @throws Error when the request fails or payload is invalid.
 */
export async function fetchAssetPageInfo(
	assetID: string,
	pageSize: number,
	albumID?: string,
	opts: TRequestOptions = {}
): Promise<TAssetPageInfo> {
	const params = buildSearchParams({pageSize: String(normalizePageSize(pageSize))});
	if (albumID) {
		params.set('albumID', albumID);
	}
	const url = `${BASE}/assets/${encodeURIComponent(assetID)}/page-info?${params.toString()}`;
	const response = await backendFetch(url, {}, opts);
	if (!response.ok) {
		throw new Error(`Failed to fetch asset page info: ${response.status}`);
	}
	return parseJSON(response, isAssetPageInfo, 'Invalid asset page info response payload');
}

/**
 * Triggers backend sync job execution.
 *
 * @param opts - Optional request options such as abort signal and timeout override.
 * @throws Error when sync request is not accepted.
 */
export async function triggerSync(opts: TRequestOptions = {}): Promise<void> {
	const response = await backendFetch(`${BASE}/sync`, {method: 'POST'}, opts);
	if (!response.ok) {
		throw new Error(`Failed to trigger sync: ${response.status}`);
	}
}

/**
 * Queries backend sync status.
 *
 * @param opts - Optional request options such as abort signal and timeout override.
 * @returns Whether synchronization is currently running.
 * @throws Error when status endpoint request fails or response payload is invalid.
 */
export async function fetchSyncStatus(opts: TRequestOptions = {}): Promise<{syncing: boolean}> {
	const response = await backendFetch(`${BASE}/sync/status`, {}, opts);
	if (!response.ok) {
		throw new Error(`Failed to fetch sync status: ${response.status}`);
	}
	return parseJSON(response, isSyncStatus, 'Invalid sync status response payload');
}

export async function fetchLibraries(opts: TRequestOptions = {}): Promise<TLibraryRow[]> {
	const response = await backendFetch(`${BASE}/libraries`, {}, opts);
	if (!response.ok) {
		throw new Error(`Failed to fetch libraries: ${response.status}`);
	}
	return parseJSON(
		response,
		(value): value is TLibraryRow[] => Array.isArray(value) && value.every(isLibraryRow),
		'Invalid libraries response payload'
	);
}

export async function updateLibrary(libraryID: string, isHidden: boolean, opts: TRequestOptions = {}): Promise<void> {
	const response = await backendFetch(
		`${BASE}/libraries/${encodeURIComponent(libraryID)}`,
		{
			method: 'PUT',
			headers: {'Content-Type': 'application/json'}, //eslint-disable-line
			body: JSON.stringify({isHidden})
		},
		opts
	);
	if (!response.ok) {
		throw new Error(`Failed to update library: ${response.status}`);
	}
}

export async function refreshLibraries(opts: TRequestOptions = {}): Promise<TLibraryRow[]> {
	const response = await backendFetch(`${BASE}/libraries/refresh`, {method: 'POST'}, opts);
	if (!response.ok) {
		throw new Error(`Failed to refresh libraries: ${response.status}`);
	}
	return parseJSON(
		response,
		(value): value is TLibraryRow[] => Array.isArray(value) && value.every(isLibraryRow),
		'Invalid libraries response payload'
	);
}
