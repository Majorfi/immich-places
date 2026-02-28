import {GRID_COLUMN_OPTIONS, PAGE_SIZE_OPTIONS} from '@/utils/view';

/**
 * Shared CSS transition preset for the filter expand/collapse panel.
 */
export const FILTER_BAR_TRANSITION_CLASS = 'overflow-hidden transition-[max-height,opacity] duration-200 ease-in-out';

/**
 * Allowed page-size values used for URL validation and UI fallback.
 */
export const ALLOWED_PAGE_SIZES = new Set<number>(PAGE_SIZE_OPTIONS);
/**
 * Allowed grid-column values used for URL validation and UI fallback.
 */
export const ALLOWED_GRID_COLUMNS = new Set<number>(GRID_COLUMN_OPTIONS);
