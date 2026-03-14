import {parseCoordinatePair} from '@/utils/coordinates';
import {DEFAULT_GEOCODE_RESULT_LIMIT, LOCAL_GEOCODE_SEARCH_PATH, MAX_GEOCODE_RESULT_LIMIT} from '@/utils/geocoding';

import type {TNominatimResult} from '@/shared/types/nominatim';

/**
 * Search options accepted by the remote Nominatim-backed search API.
 */
type TNominatimSearchOptions = {
	baseURL: string;
	signal?: AbortSignal;
	limit?: number;
	acceptLanguage?: string;
};

function parseTextValue(value: unknown): string | null {
	if (typeof value === 'string') {
		return value;
	}
	if (typeof value === 'number' && Number.isFinite(value)) {
		return String(value);
	}
	return null;
}

function parsePlaceID(rec: Record<string, unknown>): number | null {
	const rawPlaceID = parseTextValue(rec.place_id);
	const altPlaceID = parseTextValue(rec.placeID);

	if (rawPlaceID !== null) {
		const parsed = Number.parseInt(rawPlaceID, 10);
		if (Number.isFinite(parsed)) {
			return parsed;
		}
	}
	if (altPlaceID !== null) {
		const parsed = Number.parseInt(altPlaceID, 10);
		if (Number.isFinite(parsed)) {
			return parsed;
		}
	}

	return null;
}

function parseStringField(value: unknown): string | null {
	if (typeof value === 'string') {
		return value;
	}
	return null;
}

function toTNominatimResult(item: unknown): TNominatimResult | null {
	if (typeof item !== 'object' || item === null) {
		return null;
	}
	const rec = item as Record<string, unknown>;

	const placeID = parsePlaceID(rec);
	const rawLat = parseTextValue(rec.lat);
	const rawLon = parseTextValue(rec.lon);
	const type = parseStringField(rec.type);
	const displayName = parseStringField(rec.display_name);
	const legacyDisplayName = parseStringField(rec.displayName);

	if (
		placeID === null ||
		rawLat === null ||
		rawLon === null ||
		type === null ||
		(displayName === null && legacyDisplayName === null)
	) {
		return null;
	}

	const coordinates = parseCoordinatePair(rawLat, rawLon);
	if (!coordinates) {
		return null;
	}
	return {
		placeID,
		lat: rawLat,
		lon: rawLon,
		displayName: displayName ?? legacyDisplayName ?? '',
		type
	};
}

/**
 * Clamp and sanitize search limit arguments.
 *
 * @param limit - Optional requested count.
 * @returns Limit constrained to configured bounds.
 */
function normalizeLimit(limit: number | undefined): number {
	if (limit === undefined || !Number.isFinite(limit)) {
		return DEFAULT_GEOCODE_RESULT_LIMIT;
	}
	return Math.min(MAX_GEOCODE_RESULT_LIMIT, Math.max(1, Math.trunc(limit)));
}

/**
 * Parse and validate Nominatim response payload.
 *
 * @param data - Unknown JSON payload from geocoding endpoint.
 * @throws Error when payload is not an array.
 * @returns Array of validated results (invalid items are skipped).
 */
function parseTNominatimResults(data: unknown): TNominatimResult[] {
	if (!Array.isArray(data)) {
		throw new Error('Invalid geocode response payload');
	}
	const results: TNominatimResult[] = [];
	for (const item of data) {
		const parsed = toTNominatimResult(item);
		if (parsed) {
			results.push(parsed);
		}
	}
	return results;
}

/**
 * Search places through local geocode endpoint with request cancellation support.
 *
 * @param query - User-entered location query.
 * @param signal - Optional abort signal for cancellation.
 * @returns Promise of validated location candidates.
 */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<TNominatimResult[]> {
	const trimmed = query.trim();
	if (!trimmed) {
		return [];
	}

	const params = new URLSearchParams({q: trimmed});
	const response = await fetch(`${LOCAL_GEOCODE_SEARCH_PATH}?${params}`, {
		signal,
		credentials: 'same-origin'
	});

	if (!response.ok) {
		throw new Error(`Geocode search failed: ${response.status}`);
	}
	const data: unknown = await response.json();
	return parseTNominatimResults(data);
}

/**
 * Search places through public Nominatim endpoint.
 *
 * @param query - User-entered location query.
 * @param options - Optional abort, limit, and localization options.
 * @returns Promise of validated location candidates.
 */
export async function searchPlacesFromNominatim(
	query: string,
	options: TNominatimSearchOptions
): Promise<TNominatimResult[]> {
	const trimmed = query.trim();
	if (!trimmed) {
		return [];
	}

	const params = new URLSearchParams({
		q: trimmed,
		format: 'json',
		limit: String(normalizeLimit(options.limit))
	});

	const headers = new Headers({
		Accept: 'application/json',
		'User-Agent': 'ImmichPlaces/1.0' //eslint-disable-line
	});
	if (options.acceptLanguage?.trim()) {
		headers.set('Accept-Language', options.acceptLanguage.slice(0, 128));
	}

	const response = await fetch(`${options.baseURL}/search?${params}`, {
		headers,
		signal: options.signal,
		cache: 'no-store'
	});
	if (!response.ok) {
		throw new Error(`Nominatim search failed: ${response.status}`);
	}
	const data: unknown = await response.json();
	return parseTNominatimResults(data);
}
