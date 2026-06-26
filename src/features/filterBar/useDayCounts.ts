'use client';

import {addMonths, endOfMonth, format, startOfMonth, subMonths} from 'date-fns';
import {useCallback, useEffect, useRef, useState} from 'react';

import {useView} from '@/shared/context/AppContext';
import {fetchAssetDayCounts} from '@/shared/services/backendApi';

export function useDayCounts(visibleMonth: Date, open: boolean): Record<string, number> {
	const {gpsFilter, hiddenFilter, selectedAlbumID, selectedTagID} = useView();
	const [counts, setCounts] = useState<Record<string, number>>({});
	const abortRef = useRef<AbortController | null>(null);

	const fetchCounts = useCallback(
		async (month: Date, signal: AbortSignal): Promise<void> => {
			const rangeStart = format(startOfMonth(subMonths(month, 1)), 'yyyy-MM-dd');
			const rangeEnd = format(endOfMonth(addMonths(month, 1)), 'yyyy-MM-dd');
			try {
				const result = await fetchAssetDayCounts(
					rangeStart,
					rangeEnd,
					gpsFilter,
					hiddenFilter,
					selectedAlbumID ?? undefined,
					selectedTagID ?? undefined,
					{signal}
				);
				if (!signal.aborted) {
					setCounts(result);
				}
			} catch {
				// ignore aborted requests
			}
		},
		[gpsFilter, hiddenFilter, selectedAlbumID, selectedTagID]
	);

	useEffect(() => {
		if (!open) {
			return;
		}
		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;
		void fetchCounts(visibleMonth, controller.signal);
		return () => {
			controller.abort();
		};
	}, [visibleMonth, open, fetchCounts]);

	return counts;
}
