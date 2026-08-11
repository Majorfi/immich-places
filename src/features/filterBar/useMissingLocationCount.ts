'use client';

import {useEffect, useState} from 'react';

import {useBackend, useView} from '@/shared/context/AppContext';
import {fetchMissingLocationCount} from '@/shared/services/backendApi';

/**
 * Counts the assets missing coordinates under the currently active filters.
 *
 * Refetches when a filter changes, and when `health` is replaced — the backend
 * status refresh that follows a sync or a location edit — so the badge drops as
 * soon as photos get placed.
 *
 * @returns The missing-location count, or `null` while unknown.
 */
export function useMissingLocationCount(): number | null {
	const {health} = useBackend();
	const {hiddenFilter, selectedAlbumID, selectedTagID, startDate, endDate} = useView();
	const [count, setCount] = useState<number | null>(null);

	useEffect(() => {
		if (!health) {
			setCount(null);
			return;
		}
		const controller = new AbortController();
		fetchMissingLocationCount(
			hiddenFilter,
			selectedAlbumID ?? undefined,
			selectedTagID ?? undefined,
			startDate ?? undefined,
			endDate ?? undefined,
			{signal: controller.signal}
		)
			.then(result => {
				if (!controller.signal.aborted) {
					setCount(result);
				}
			})
			.catch(() => {
				if (!controller.signal.aborted) {
					setCount(null);
				}
			});

		return () => {
			controller.abort();
		};
	}, [health, hiddenFilter, selectedAlbumID, selectedTagID, startDate, endDate]);

	return count;
}
