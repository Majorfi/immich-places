'use client';

import {useCallback, useEffect, useRef, useState} from 'react';

import {fetchAlbums} from '@/shared/services/backendApi';

import type {TAlbumRow} from '@/shared/types/album';
import type {TGPSFilter} from '@/shared/types/map';

/**
 * Albums hook return contract.
 * `albums` is the resolved list of album rows for the current filter.
 * `isLoading` is true while a fetch request is in progress.
 * `error` is a human-readable message if the request fails.
 * `load` triggers a refresh of the album list.
 */
type TUseAlbumsReturnProps = {
	albums: TAlbumRow[];
	isLoading: boolean;
	error: string | null;
	load: () => Promise<void>;
	clear: () => void;
};

/**
 * Fetches and caches album rows with safe cancellation on rapid filter changes.
 *
 * The hook aborts any in-flight request when a new filter change occurs so stale
 * responses cannot overwrite the latest data.
 *
 * @param gpsFilter - Active GPS filter used by the backend query.
 *   - gpsFilter: Active GPS filter used by the backend query.
 * @returns Album list state and a reload action.
 */
export function useAlbums(gpsFilter: TGPSFilter): TUseAlbumsReturnProps {
	const [albums, setAlbums] = useState<TAlbumRow[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const requestIDRef = useRef(0);
	const abortRef = useRef<AbortController | null>(null);

	const load = useCallback(async () => {
		requestIDRef.current += 1;
		const requestID = requestIDRef.current;
		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;

		setIsLoading(true);
		setError(null);
		try {
			const result = await fetchAlbums(gpsFilter, {signal: controller.signal});
			if (requestIDRef.current !== requestID) {
				return;
			}
			setAlbums(result);
		} catch (err) {
			if (controller.signal.aborted) {
				return;
			}
			if (requestIDRef.current !== requestID) {
				return;
			}
			setError(err instanceof Error ? err.message : 'Failed to load albums');
		} finally {
			if (requestIDRef.current === requestID) {
				setIsLoading(false);
			}
		}
	}, [gpsFilter]);

	const prevTGPSFilter = useRef(gpsFilter);
	useEffect(() => {
		if (prevTGPSFilter.current !== gpsFilter) {
			prevTGPSFilter.current = gpsFilter;
			setAlbums([]);
			void load();
		}
	}, [gpsFilter, load]);

	useEffect(() => {
		return () => {
			abortRef.current?.abort();
		};
	}, []);

	const clear = useCallback(() => {
		abortRef.current?.abort();
		abortRef.current = null;
		requestIDRef.current += 1;
		setAlbums([]);
		setIsLoading(false);
		setError(null);
	}, []);

	return {albums, isLoading, error, load, clear};
}
