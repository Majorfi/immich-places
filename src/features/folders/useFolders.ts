'use client';

import {useCallback, useEffect, useRef, useState} from 'react';

import {getFolders} from '@/shared/services/backendApi';

import type {TFolderTree} from '@/shared/types/folder';
import type {TGPSFilter, THiddenFilter} from '@/shared/types/map';

type TUseFoldersReturnProps = {
	folderTree: TFolderTree | null;
	isStale: boolean;
	isLoading: boolean;
	error: string | null;
	load: () => Promise<void>;
	clear: () => void;
};

export function useFolders(
	gpsFilter: TGPSFilter,
	hiddenFilter: THiddenFilter,
	tagID: string | null,
	startDate: string | null,
	endDate: string | null
): TUseFoldersReturnProps {
	const [folderTree, setFolderTree] = useState<TFolderTree | null>(null);
	const [isStale, setIsStale] = useState(true);
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

		setIsStale(false);
		setIsLoading(true);
		setError(null);
		try {
			const result = await getFolders(
				gpsFilter,
				hiddenFilter,
				tagID ?? undefined,
				startDate ?? undefined,
				endDate ?? undefined,
				{signal: controller.signal}
			);
			if (requestIDRef.current !== requestID) {
				return;
			}
			setFolderTree(result);
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
				setError('Failed to load folders');
			}
		} finally {
			if (requestIDRef.current === requestID) {
				setIsLoading(false);
			}
		}
	}, [gpsFilter, hiddenFilter, tagID, startDate, endDate]);

	const prevFilterRef = useRef({gpsFilter, hiddenFilter, tagID, startDate, endDate});
	useEffect(() => {
		const prev = prevFilterRef.current;
		if (
			prev.gpsFilter !== gpsFilter ||
			prev.hiddenFilter !== hiddenFilter ||
			prev.tagID !== tagID ||
			prev.startDate !== startDate ||
			prev.endDate !== endDate
		) {
			prevFilterRef.current = {gpsFilter, hiddenFilter, tagID, startDate, endDate};
			abortRef.current?.abort();
			requestIDRef.current += 1;
			// The previous tree stays on screen until the new one arrives: blanking it
			// collapses the list, which resets both expansion state and scroll position.
			setIsStale(true);
			setIsLoading(false);
			setError(null);
		}
	}, [gpsFilter, hiddenFilter, tagID, startDate, endDate]);

	useEffect(() => {
		return () => {
			abortRef.current?.abort();
		};
	}, []);

	const clear = useCallback(() => {
		abortRef.current?.abort();
		abortRef.current = null;
		requestIDRef.current += 1;
		setFolderTree(null);
		setIsStale(true);
		setIsLoading(false);
		setError(null);
	}, []);

	return {folderTree, isStale, isLoading, error, load, clear};
}
