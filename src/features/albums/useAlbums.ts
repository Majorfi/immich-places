'use client';

import {useCallback, useEffect, useRef, useState} from 'react';

import {fetchAlbums} from '@/shared/services/backendApi';

import type {TAlbumRow} from '@/shared/types/album';
import type {TGPSFilter} from '@/shared/types/map';

type TUseAlbumsReturnProps = {
	albums: TAlbumRow[];
	isLoading: boolean;
	error: string | null;
	load: () => Promise<void>;
	clear: () => void;
};

export function useAlbums(
	gpsFilter: TGPSFilter,
	startDate: string | null,
	endDate: string | null
): TUseAlbumsReturnProps {
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
			const result = await fetchAlbums(gpsFilter, startDate ?? undefined, endDate ?? undefined, {
				signal: controller.signal
			});
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
			if (err instanceof Error) {
				setError(err.message);
			} else {
				setError('Failed to load albums');
			}
		} finally {
			if (requestIDRef.current === requestID) {
				setIsLoading(false);
			}
		}
	}, [gpsFilter, startDate, endDate]);

	const prevFilterRef = useRef({gpsFilter, startDate, endDate});
	useEffect(() => {
		const prev = prevFilterRef.current;
		if (prev.gpsFilter !== gpsFilter || prev.startDate !== startDate || prev.endDate !== endDate) {
			prevFilterRef.current = {gpsFilter, startDate, endDate};
			void load();
		}
	}, [gpsFilter, startDate, endDate, load]);

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
