const MIN_LATITUDE = -90;
const MAX_LATITUDE = 90;
const MIN_LONGITUDE = -180;
const MAX_LONGITUDE = 180;

function parseCoordinateValue(value: string, minimum: number, maximum: number): number | null {
	const parsed = Number.parseFloat(value.trim());
	if (!Number.isFinite(parsed)) {
		return null;
	}
	if (parsed < minimum || parsed > maximum) {
		return null;
	}
	return parsed;
}

export function parseCoordinatePair(latitude: string, longitude: string): {latitude: number; longitude: number} | null {
	const parsedLatitude = parseCoordinateValue(latitude, MIN_LATITUDE, MAX_LATITUDE);
	const parsedLongitude = parseCoordinateValue(longitude, MIN_LONGITUDE, MAX_LONGITUDE);
	if (parsedLatitude === null || parsedLongitude === null) {
		return null;
	}
	return {latitude: parsedLatitude, longitude: parsedLongitude};
}
