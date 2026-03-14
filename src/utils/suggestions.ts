import type {TSuggestionCategoryKey} from '@/shared/types/suggestion';

/**
 * Canonical suggestion category keys used by UI sections and translations.
 */
export const SUGGESTION_CATEGORY_KEY = {
	suggested: 'suggested',
	album: 'album',
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
	sameDay: 'Same Day',
	twoDay: 'Same Week',
	weekly: 'Same Month',
	frequent: 'Frequent'
};

/** Maximum number of suggestion cards rendered per category. */
export const SUGGESTION_PANEL_MAX_ITEMS = 3;
/** Maximum number of frequent-location suggestion cards rendered. */
export const SUGGESTION_PANEL_FREQUENT_MAX_ITEMS = 5;
