import type {TSuggestionCategoryKey} from '@/shared/types/suggestion';

/**
 * Canonical suggestion category keys used by UI sections and translations.
 */
export const SUGGESTION_CATEGORY_KEY = {
	suggested: 'suggested',
	album: 'album',
	neighbor: 'neighbor',
	sameDay: 'sameDay',
	twoDay: 'twoDay',
	weekly: 'weekly',
	frequent: 'frequent'
} as const;

/**
 * Human-readable labels for each suggestion section.
 */
export const SUGGESTION_CATEGORY_LABEL: Record<TSuggestionCategoryKey, string> = {
	suggested: 'Suggestions',
	album: 'Same Album',
	neighbor: 'Nearby in time',
	sameDay: 'Same Day',
	twoDay: 'Same Week',
	weekly: 'Same Month',
	frequent: 'Frequent'
};

/** Maximum number of suggestion cards rendered per category. */
export const SUGGESTION_PANEL_MAX_ITEMS = 3;
/** Maximum number of frequent-location suggestion cards rendered. */
export const SUGGESTION_PANEL_FREQUENT_MAX_ITEMS = 5;
/** Maximum number of temporal-neighbor suggestion cards rendered. */
export const SUGGESTION_PANEL_NEIGHBOR_MAX_ITEMS = 6;

/**
 * Format a signed time offset as a short human-readable distance
 * 59 = just after
 * -120 = 2 min before
 * 3600 = 1 h after
 */
export function formatNeighborOffset(secondsFromRef: number | undefined): string {
	if (secondsFromRef === undefined || !Number.isFinite(secondsFromRef)) {
		return '';
	}
	const direction = secondsFromRef < 0 ? 'before' : 'after';
	const absSeconds = Math.abs(secondsFromRef);

	if (absSeconds < 60) {
		return `just ${direction}`;
	}
	const minutes = Math.round(absSeconds / 60);
	if (minutes < 60) {
		return `${minutes} min ${direction}`;
	}
	const hours = Math.round(absSeconds / 3600);
	return `${hours} h ${direction}`;
}
