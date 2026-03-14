'use client';

import {PLACE_SEARCH_HISTORY_KEY} from '@/features/search/constant';
import {parseCoordinatePair} from '@/utils/coordinates';
import {
	PLACE_SEARCH_HISTORY_COORDINATE_DECIMALS,
	PLACE_SEARCH_HISTORY_MAX_ITEMS,
	PLACE_SEARCH_HISTORY_TTL_MS
} from '@/utils/history';
import {isRecord} from '@/utils/typeGuards';

import type {TNominatimResult} from '@/shared/types/nominatim';
import type {THistoryEntry} from '@/shared/types/search';

/**
 * Local storage interface needed for safe persistence operations.
 */
type THistoryStorage = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * Runtime guard for shape-validated persisted history entries.
 *
 * @param item - Raw parsed storage payload item.
 * @returns `true` when the item matches `THistoryEntry`.
 */
function isTHistoryEntry(item: unknown): item is THistoryEntry {
	if (!isRecord(item)) {
		return false;
	}
	if (
		typeof item.lat !== 'string' ||
		typeof item.lon !== 'string' ||
		typeof item.displayName !== 'string' ||
		(item.savedAt !== undefined && !Number.isFinite(item.savedAt))
	) {
		return false;
	}
	return parseCoordinatePair(item.lat, item.lon) !== null;
}

/**
 * Normalizes coordinates to the configured decimal precision used in persisted history.
 *
 * @param value - Numeric coordinate.
 * @returns Rounded coordinate string.
 */
function coarseCoordinate(value: number): string {
	return String(Number.parseFloat(value.toFixed(PLACE_SEARCH_HISTORY_COORDINATE_DECIMALS)));
}

/**
 * Validates, normalizes and enforces defaults for a single history entry.
 *
 * @param entry - Raw history entry candidate.
 * @param now - Current epoch timestamp used as fallback for `savedAt`.
 * @returns Normalized entry, or `null` when invalid.
 */
function normalizeEntry(entry: THistoryEntry, now: number): THistoryEntry | null {
	const coordinates = parseCoordinatePair(entry.lat, entry.lon);
	if (!coordinates) {
		return null;
	}

	const displayName = entry.displayName.trim();
	if (!displayName) {
		return null;
	}

	const savedAt = Number.isFinite(entry.savedAt) ? Math.max(0, Number(entry.savedAt)) : now;
	return {
		lat: coarseCoordinate(coordinates.latitude),
		lon: coarseCoordinate(coordinates.longitude),
		displayName,
		savedAt
	};
}

/**
 * Parse a full history entry into coordinates.
 *
 * @param entry - Stored history entry.
 * @returns Parsed coordinates or `null` when entry is invalid.
 */
export function parseHistoryCoordinates(entry: THistoryEntry): {latitude: number; longitude: number} | null {
	return parseCoordinatePair(entry.lat, entry.lon);
}

/**
 * Cleans up history entries by validating, de-duplicating, and capping count/TTL.
 *
 * @param input - Raw persisted entries.
 * @param now - Current epoch timestamp.
 * @returns Sanitized list used by UI/history consumers.
 */
function cleanHistory(input: THistoryEntry[], now: number): THistoryEntry[] {
	const seen = new Set<string>();
	const cleaned: THistoryEntry[] = [];

	for (const item of input) {
		const normalized = normalizeEntry(item, now);
		if (!normalized) {
			continue;
		}
		const savedAt = normalized.savedAt ?? now;
		if (now - savedAt > PLACE_SEARCH_HISTORY_TTL_MS) {
			continue;
		}
		const key = `${normalized.lat},${normalized.lon}`;
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		cleaned.push(normalized);
		if (cleaned.length >= PLACE_SEARCH_HISTORY_MAX_ITEMS) {
			break;
		}
	}

	return cleaned;
}

/**
 * Serialize list entries for localStorage persistence.
 *
 * @param input - History entries.
 * @returns JSON serialized storage payload.
 */
function serializeHistory(input: THistoryEntry[]): string {
	return JSON.stringify(input.slice(0, PLACE_SEARCH_HISTORY_MAX_ITEMS));
}

/**
 * Resolve available storage abstraction for persistence.
 *
 * @returns `localStorage` wrapper when available, otherwise `null`.
 */
export function getHistoryStorage(): THistoryStorage | null {
	if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
		return null;
	}
	return localStorage;
}

/**
 * Parse serialized history payload from storage.
 *
 * @param rawPayload - String payload read from storage.
 * @returns Parsed and normalized history entries.
 */
function parseHistoryPayload(rawPayload: string | null): THistoryEntry[] {
	if (!rawPayload) {
		return [];
	}

	try {
		const parsed: unknown = JSON.parse(rawPayload);
		if (!Array.isArray(parsed)) {
			return [];
		}
		return cleanHistory(parsed.filter(isTHistoryEntry), Date.now());
	} catch {
		return [];
	}
}

/**
 * Read persisted history from provided storage abstraction.
 *
 * @param storage - Storage helper or `null`.
 * @returns History entries, safely sanitized.
 */
export function readHistoryFromStorage(storage: THistoryStorage | null): THistoryEntry[] {
	if (!storage) {
		return [];
	}
	try {
		return parseHistoryPayload(storage.getItem(PLACE_SEARCH_HISTORY_KEY));
	} catch {
		return [];
	}
}

/**
 * Persist sanitized history payload to storage.
 *
 * @param history - History entries to persist.
 * @param storage - Storage writer target.
 */
function writeHistoryToStorage(history: THistoryEntry[], storage: THistoryStorage): void {
	storage.setItem(PLACE_SEARCH_HISTORY_KEY, serializeHistory(history));
}

/**
 * Add or refresh a single entry in history storage.
 *
 * @param entry - Raw history entry candidate.
 * @param storage - Optional storage target.
 */
function saveToHistory(entry: THistoryEntry, storage: THistoryStorage | null): void {
	if (!storage) {
		return;
	}
	const now = Date.now();
	const next = normalizeEntry(entry, now);
	if (!next) {
		return;
	}

	const history = readHistoryFromStorage(storage).filter(
		existing => existing.lat !== next.lat || existing.lon !== next.lon
	);
	history.unshift({...next, savedAt: now});
	try {
		writeHistoryToStorage(history, storage);
	} catch {
		// Ignore storage errors so search selection still completes when storage is unavailable.
	}
}

/**
 * Persist a nominatim result into history storage.
 *
 * @param result - Selected geocoder result.
 * @param storage - Optional storage target.
 */
export function saveSearchResultToHistory(result: TNominatimResult, storage: THistoryStorage | null): void {
	saveToHistory(
		{
			lat: result.lat,
			lon: result.lon,
			displayName: result.displayName
		},
		storage
	);
}

/**
 * Create a compact display label from full history entry.
 *
 * @param entry - History entry used by UI lists.
 * @returns Shortened display name with limited comma-separated components.
 */
export function recentHistoryDisplayName(entry: THistoryEntry): string {
	return entry.displayName.split(',').slice(0, 3).join(',').trim();
}
