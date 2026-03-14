'use client';

import {useEffect, useState} from 'react';

import {
	SUGGESTION_ALBUM_BONUS,
	SUGGESTION_COORDINATE_PRECISION_DIGITS,
	SUGGESTION_SAME_DAY_SCORE,
	SUGGESTION_TWO_DAY_SCORE,
	SUGGESTION_WEEKLY_SCORE
} from '@/features/suggestions/constant';
import {fetchSuggestions} from '@/shared/services/backendApi';
import {getErrorMessage} from '@/utils/error';
import {SUGGESTION_CATEGORY_KEY, SUGGESTION_CATEGORY_LABEL, SUGGESTION_PANEL_MAX_ITEMS} from '@/utils/suggestions';

import type {TLocationCluster, TSuggestionCategory, TSuggestionsResponse} from '@/shared/types/suggestion';

/**
 * Result shape for fetching and grouping suggestions.
 */
type TSuggestionsResult = {
	suggestions: TLocationCluster[];
	categories: TSuggestionCategory[];
	error: string | null;
};

/**
 * Round coordinate based on configured precision for stable cluster keys.
 *
 * @param value - Raw coordinate.
 * @returns Rounded coordinate.
 */
function roundCoordinate(value: number): number {
	const precisionMultiplier = 10 ** SUGGESTION_COORDINATE_PRECISION_DIGITS;
	return Math.round(value * precisionMultiplier) / precisionMultiplier;
}

/**
 * Stable dedupe key for a location cluster.
 *
 * @param c - Cluster payload.
 * @returns Rounded latitude/longitude key.
 */
function clusterKey(c: TLocationCluster): string {
	return `${roundCoordinate(c.latitude)},${roundCoordinate(c.longitude)}`;
}

/**
 * Build a set of dedupe keys for one category response.
 *
 * @param clusters - Clusters to process.
 * @returns Set of cluster keys.
 */
function buildKeySet(clusters: TLocationCluster[]): Set<string> {
	return new Set(clusters.map(clusterKey));
}

type TScoredCluster = {
	cluster: TLocationCluster;
	score: number;
	key: string;
};

/**
 * Merge and score candidate suggestion clusters from multiple buckets.
 *
 * Prioritizes same-day, then two-day, then weekly clusters and applies album bonus.
 *
 * @param response - Raw suggestion response.
 * @returns Up to configured max number of clusters sorted by score.
 */
function buildSuggested(response: TSuggestionsResponse): TLocationCluster[] {
	const sameDayKeys = buildKeySet(response.sameDayClusters ?? []);
	const twoDayKeys = buildKeySet(response.twoDayClusters ?? []);
	const weeklyKeys = buildKeySet(response.weeklyClusters ?? []);
	const albumKeys = buildKeySet(response.albumClusters ?? []);

	const scored: TScoredCluster[] = [];
	const seenKeys = new Set<string>();

	const allClusters = [
		...(response.albumClusters ?? []),
		...(response.sameDayClusters ?? []),
		...(response.twoDayClusters ?? []),
		...(response.weeklyClusters ?? [])
	];

	for (const cluster of allClusters) {
		const key = clusterKey(cluster);
		if (seenKeys.has(key)) {
			continue;
		}
		seenKeys.add(key);

		let score = 0;
		if (sameDayKeys.has(key)) {
			score += SUGGESTION_SAME_DAY_SCORE;
		} else if (twoDayKeys.has(key)) {
			score += SUGGESTION_TWO_DAY_SCORE;
		} else if (weeklyKeys.has(key)) {
			score += SUGGESTION_WEEKLY_SCORE;
		}
		if (albumKeys.has(key)) {
			score += SUGGESTION_ALBUM_BONUS;
		}

		scored.push({cluster, score, key});
	}

	scored.sort((a, b) => {
		if (b.score !== a.score) {
			return b.score - a.score;
		}
		return b.cluster.count - a.cluster.count;
	});

	return scored.slice(0, SUGGESTION_PANEL_MAX_ITEMS).map(s => s.cluster);
}

/**
 * Build category tabs from server response with optional frequent-location suppression.
 *
 * @param response - Raw suggestion response.
 * @param excludeFrequentLocations - Skip frequent locations when true.
 * @returns List of suggestion categories and cluster groups.
 */
function buildCategories(response: TSuggestionsResponse, excludeFrequentLocations: boolean): TSuggestionCategory[] {
	const cats: TSuggestionCategory[] = [];

	const suggested = buildSuggested(response);
	if (suggested.length > 0) {
		cats.push({
			key: SUGGESTION_CATEGORY_KEY.suggested,
			label: SUGGESTION_CATEGORY_LABEL[SUGGESTION_CATEGORY_KEY.suggested],
			clusters: suggested
		});
	}

	if (response.albumClusters?.length) {
		cats.push({
			key: SUGGESTION_CATEGORY_KEY.album,
			label: SUGGESTION_CATEGORY_LABEL[SUGGESTION_CATEGORY_KEY.album],
			clusters: response.albumClusters
		});
	}

	const hasSameDay = (response.sameDayClusters?.length ?? 0) > 0;
	const hasTwoDay = (response.twoDayClusters?.length ?? 0) > 0;

	if (hasSameDay) {
		cats.push({
			key: SUGGESTION_CATEGORY_KEY.sameDay,
			label: SUGGESTION_CATEGORY_LABEL[SUGGESTION_CATEGORY_KEY.sameDay],
			clusters: response.sameDayClusters
		});
	} else if (hasTwoDay) {
		cats.push({
			key: SUGGESTION_CATEGORY_KEY.twoDay,
			label: SUGGESTION_CATEGORY_LABEL[SUGGESTION_CATEGORY_KEY.twoDay],
			clusters: response.twoDayClusters
		});
	} else if (response.weeklyClusters?.length) {
		cats.push({
			key: SUGGESTION_CATEGORY_KEY.weekly,
			label: SUGGESTION_CATEGORY_LABEL[SUGGESTION_CATEGORY_KEY.weekly],
			clusters: response.weeklyClusters
		});
	}
	if (!excludeFrequentLocations && response.frequentLocations?.length) {
		cats.push({
			key: SUGGESTION_CATEGORY_KEY.frequent,
			label: SUGGESTION_CATEGORY_LABEL[SUGGESTION_CATEGORY_KEY.frequent],
			clusters: response.frequentLocations
		});
	}

	return cats;
}

/**
 * Fetches and normalizes location suggestions for a selected asset.
 *
 * Handles cancellation via effect cleanup and returns categories for UI tabs.
 *
 * @param selectedAssetID - ID of selected asset without GPS.
 * @param albumID - Optional album scope filter.
 * @param excludeFrequentLocations - Exclude frequent locations when needed.
 * @returns Suggestion clusters, categories and error state.
 */
export function useSuggestions(
	selectedAssetID: string | null,
	albumID: string | null,
	excludeFrequentLocations = false
): TSuggestionsResult {
	const [suggestions, setSuggestions] = useState<TLocationCluster[]>([]);
	const [categories, setCategories] = useState<TSuggestionCategory[]>([]);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!selectedAssetID) {
			setSuggestions([]);
			setCategories([]);
			setError(null);
			return;
		}

		const controller = new AbortController();

		fetchSuggestions(selectedAssetID, albumID ?? undefined, {signal: controller.signal})
			.then(response => {
				if (controller.signal.aborted) {
					return;
				}
				const cats = buildCategories(response, excludeFrequentLocations);
				setCategories(cats);
				setSuggestions(cats.flatMap(c => c.clusters));
				setError(null);
			})
			.catch(error => {
				if (controller.signal.aborted) {
					return;
				}
				setSuggestions([]);
				setCategories([]);
				setError(getErrorMessage(error, 'Failed to load suggestions'));
			});

		return () => {
			controller.abort();
		};
	}, [selectedAssetID, albumID, excludeFrequentLocations]);

	return {suggestions, categories, error};
}
