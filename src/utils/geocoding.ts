/**
 * Geocoding integration constants.
 */

const DEFAULT_GEOCODE_URL = 'https://nominatim.openstreetmap.org';
const DEFAULT_GEOCODE_TIMEOUT_S = 10;
const MIN_GEOCODE_TIMEOUT_S = 1;

function parseTimeoutSeconds(): number {
	const value = Number(process.env.GEOCODE_TIMEOUT);
	if (Number.isFinite(value) && value >= MIN_GEOCODE_TIMEOUT_S) {
		return value;
	}
	return DEFAULT_GEOCODE_TIMEOUT_S;
}

export const GEOCODE_PROVIDER = process.env.GEOCODE_PROVIDER || 'nominatim';
export const GEOCODE_API_KEY = process.env.GEOCODE_API_KEY || '';
export const GEOCODE_URL = process.env.GEOCODE_URL || DEFAULT_GEOCODE_URL;

if (GEOCODE_PROVIDER !== 'nominatim') {
	console.warn(
		`[geocode] Unknown GEOCODE_PROVIDER "${GEOCODE_PROVIDER}" — only "nominatim" is supported. Falling back to nominatim.`
	);
}
export const LOCAL_GEOCODE_SEARCH_PATH = '/api/geocode/search';
export const DEFAULT_GEOCODE_RESULT_LIMIT = 5;
export const MAX_GEOCODE_RESULT_LIMIT = 10;
export const GEOCODE_QUERY_MIN_LENGTH = 2;
export const GEOCODE_QUERY_MAX_LENGTH = 200;
export const GEOCODE_UPSTREAM_TIMEOUT_MS = parseTimeoutSeconds() * 1000;
