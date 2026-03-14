'use client';

import {useCallback, useEffect, useMemo, useState} from 'react';

import {fetchFrequentLocations} from '@/shared/services/backendApi';
import {getErrorMessage} from '@/utils/error';
import {
	SUGGESTION_CATEGORY_KEY,
	SUGGESTION_CATEGORY_LABEL,
	SUGGESTION_PANEL_FREQUENT_MAX_ITEMS,
	SUGGESTION_PANEL_MAX_ITEMS
} from '@/utils/suggestions';

import type {TLocationCluster, TSuggestionCategory, TSuggestionCategoryKey} from '@/shared/types/suggestion';

/**
 * Color map used by suggestion category keys.
 */
const categoryColors: Record<TSuggestionCategoryKey, string> = {
	suggested: '#2563eb',
	album: '#0d9488',
	sameDay: '#d97706',
	twoDay: '#ea580c',
	weekly: '#7c3aed',
	frequent: '#6b7280'
};

/** Shared pill button styles for suggestion controls. */
export const pillClass =
	'flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/60 bg-white/80 px-3 py-1.5 text-[11px] font-medium text-(--color-text-secondary) shadow-sm backdrop-blur-md transition-all hover:bg-white hover:shadow-md';
/** Shared suggestion panel container styles. */
export const panelClass =
	'absolute left-0 top-[calc(100%+6px)] z-10 min-w-[360px] w-full max-w-[min(100%,720px)] overflow-hidden rounded-lg border border-white/50 bg-white/75 shadow-lg backdrop-blur-xl';
/** Shared suggestion list item styles. */
export const itemClass =
	'flex w-full cursor-pointer items-center justify-between rounded-lg border-0 bg-transparent px-2.5 py-2 text-left text-[13px] transition-colors hover:bg-white/80';

/**
 * Runtime type guard for known suggestion category keys.
 */
function isSuggestionCategoryKey(value: string): value is TSuggestionCategoryKey {
	return value in categoryColors;
}

/**
 * Resolve a display color for a suggestion category key.
 *
 * @param value - Raw category identifier from the server.
 * @returns CSS color string.
 */
export function categoryColor(value: string): string {
	if (isSuggestionCategoryKey(value)) {
		return categoryColors[value];
	}
	return categoryColors.suggested;
}

/**
 * Builds a stable key for deduping and rendering clusters.
 *
 * @param cluster - Location cluster to identify.
 * @returns Stable key string.
 */
export function clusterStableKey(cluster: TLocationCluster): string {
	return `${cluster.latitude}:${cluster.longitude}:${cluster.label}:${cluster.count}`;
}

type TFrequentSuggestionsState = {
	clusters: TLocationCluster[];
	error: string | null;
};

/**
 * Loads frequent location clusters lazily when enabled and missing.
 *
 * @param selectedAssetsCount - Number of currently selected assets.
 * @param requestLoad - Whether to trigger a backend fetch.
 * @param frequentClustersFromSuggestions - Existing frequent clusters already loaded from suggestions.
 * @returns Frequent clusters and any load error.
 */
function useFrequentSuggestionClusters(
	selectedAssetsCount: number,
	requestLoad: boolean,
	frequentClustersFromSuggestions: TLocationCluster[]
): TFrequentSuggestionsState {
	const [frequentClusters, setFrequentClusters] = useState<TLocationCluster[]>([]);
	const [error, setError] = useState<string | null>(null);
	const hasFrequentSuggestions = frequentClustersFromSuggestions.length > 0;

	useEffect(() => {
		if (selectedAssetsCount === 0) {
			return;
		}
		if (frequentClusters.length > 0 || hasFrequentSuggestions || !requestLoad) {
			return;
		}
		const controller = new AbortController();
		setError(null);
		fetchFrequentLocations({signal: controller.signal})
			.then(setFrequentClusters)
			.catch(error => {
				if (controller.signal.aborted) {
					return;
				}
				setError(getErrorMessage(error, 'Failed to load frequent locations'));
			});
		return () => controller.abort();
	}, [selectedAssetsCount, frequentClusters.length, hasFrequentSuggestions, requestLoad]);

	if (hasFrequentSuggestions) {
		return {clusters: frequentClustersFromSuggestions, error: null};
	}

	return {clusters: frequentClusters, error};
}

/**
 * Shape returned by suggestion state orchestration.
 */
type TSuggestionState = {
	allCategories: TSuggestionCategory[];
	hasContent: boolean;
	suggestionCount: number;
	frequentError: string | null;
	requestFrequentLoad: () => void;
};

/**
 * Compose suggestion categories and counts for the suggestions panel.
 *
 * @param selectedAssetsCount - Number of selected assets.
 * @param categories - Raw categories coming from catalog suggestions.
 * @returns Category list and UI state for the suggestion panel.
 */
export function useSuggestionState(selectedAssetsCount: number, categories: TSuggestionCategory[]): TSuggestionState {
	const frequentClustersFromSuggestions = useMemo(
		() => categories.find(c => c.key === SUGGESTION_CATEGORY_KEY.frequent)?.clusters ?? [],
		[categories]
	);
	const [shouldLoadFrequent, setShouldLoadFrequent] = useState(false);
	const {clusters: frequentClusters, error: frequentError} = useFrequentSuggestionClusters(
		selectedAssetsCount,
		shouldLoadFrequent,
		frequentClustersFromSuggestions
	);

	const requestFrequentLoad = useCallback(() => {
		setShouldLoadFrequent(true);
	}, []);

	const allCategories = useMemo(() => {
		const next: TSuggestionCategory[] = [];
		const assetCategories = categories.filter(
			c => c.clusters.length > 0 && c.key !== SUGGESTION_CATEGORY_KEY.frequent
		);

		if (selectedAssetsCount > 0) {
			next.push(...assetCategories);
		}
		if (frequentClusters.length > 0) {
			next.push({
				key: SUGGESTION_CATEGORY_KEY.frequent,
				label: SUGGESTION_CATEGORY_LABEL[SUGGESTION_CATEGORY_KEY.frequent],
				clusters: frequentClusters
			});
		}
		return next;
	}, [categories, frequentClusters, selectedAssetsCount]);

	const suggestionCount = useMemo(() => {
		const seen = new Set<string>();
		for (const category of allCategories) {
			if (category.key === SUGGESTION_CATEGORY_KEY.frequent) {
				continue;
			}
			for (const cluster of category.clusters.slice(0, SUGGESTION_PANEL_MAX_ITEMS)) {
				seen.add(clusterStableKey(cluster));
			}
		}
		return seen.size;
	}, [allCategories]);

	return {
		allCategories,
		hasContent: allCategories.length > 0,
		suggestionCount,
		frequentError,
		requestFrequentLoad
	};
}

/**
 * Returns max visible cluster count per category.
 *
 * @param categoryKey - Suggestion category key.
 * @returns Category-specific max items for the UI panel.
 */
export function resolveMaxItemsForCategory(categoryKey: string): number {
	if (categoryKey === SUGGESTION_CATEGORY_KEY.frequent) {
		return SUGGESTION_PANEL_FREQUENT_MAX_ITEMS;
	}
	return SUGGESTION_PANEL_MAX_ITEMS;
}
