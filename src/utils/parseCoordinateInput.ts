import {parseCoordinatePair} from '@/utils/coordinates';

export function parseCoordinateInput(input: string): {latitude: number; longitude: number} | null {
	const trimmed = input.trim();
	if (!trimmed) {
		return null;
	}

	let parts: string[];
	if (trimmed.includes(',')) {
		parts = trimmed.split(',').map(s => s.trim());
	} else {
		parts = trimmed.split(/\s+/);
	}

	if (parts.length !== 2) {
		return null;
	}

	return parseCoordinatePair(parts[0], parts[1]);
}
