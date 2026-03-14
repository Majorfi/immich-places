/**
 * Pagination rendering constants and helpers.
 */
/** Number of page buttons shown before collapsing into ellipsis. */
const PAGINATION_ALL_PAGES_LIMIT = 7;
/** Neighbor radius around current page before ellipsis appears. */
const PAGINATION_NEIGHBOR_WINDOW = 1;

/**
 * Builds a compact page-range model for paginator UI.
 *
 * @param current - Current page number.
 * @param total - Total page count.
 * @returns Sequence of page numbers and `'ellipsis'` separators.
 */
export function buildPageRange(current: number, total: number): (number | 'ellipsis')[] {
	if (total <= PAGINATION_ALL_PAGES_LIMIT) {
		return Array.from({length: total}, (_, i) => i + 1);
	}

	const pages = new Set<number>();
	for (let i = current - PAGINATION_NEIGHBOR_WINDOW; i <= current + PAGINATION_NEIGHBOR_WINDOW; i++) {
		if (i >= 1 && i <= total) {
			pages.add(i);
		}
	}

	const sorted = [...pages].sort((a, b) => a - b);
	const result: (number | 'ellipsis')[] = [];
	for (let i = 0; i < sorted.length; i++) {
		if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
			result.push('ellipsis');
		}
		result.push(sorted[i]);
	}
	return result;
}
