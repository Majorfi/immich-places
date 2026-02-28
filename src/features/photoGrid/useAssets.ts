'use client';

import {useCallback, useEffect, useRef, useState} from 'react';

import {fetchAssets} from '@/shared/services/backendApi';
import {normalizePositiveInteger} from '@/utils/math';
import {DEFAULT_PAGE_SIZE} from '@/utils/view';

import type {TAssetRow} from '@/shared/types/asset';
import type {TGPSFilter} from '@/shared/types/map';
import type {MutableRefObject} from 'react';

/**
 * Return value for `useAssets`, describing loaded photo list state and mutators.
 */
type TUseAssetsReturn = {
	assets: TAssetRow[];
	total: number;
	currentPage: number;
	isLoading: boolean;
	error: string | null;
	removeAsset: (assetID: string) => void;
	loadPageAction: (page: number) => Promise<void>;
	clear: () => void;
};

/**
 * Loads and manages paginated photo assets for the photo grid.
 *
 * Supports filter/page invalidation, abortable fetches, optimistic removal of
 * deleted assets, and focus-page restoration when requested.
 *
 * @param gpsFilter - GPS filter mode passed to the asset API.
 * @param pageSize - Page size used for network requests.
 * @param albumID - Optional album scope for fetching assets.
 * @param focusPageRef - Optional ref used to request a specific page load.
 * @returns Grid data and state-mutating helpers.
 */
export function useAssets(
	gpsFilter: TGPSFilter,
	pageSize: number,
	albumID?: string | null,
	focusPageRef?: MutableRefObject<number | null>
): TUseAssetsReturn {
	const [assets, setAssets] = useState<TAssetRow[]>([]);
	const [total, setTotal] = useState(0);
	const [currentPage, setCurrentPage] = useState(1);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const requestIDRef = useRef(0);
	const abortRef = useRef<AbortController | null>(null);

	const loadPageAction = useCallback(
		async (page: number) => {
			const normalizedPage = normalizePositiveInteger(page, 1);
			const normalizedPageSizeValue = normalizePositiveInteger(pageSize, DEFAULT_PAGE_SIZE);
			requestIDRef.current += 1;
			const requestID = requestIDRef.current;
			abortRef.current?.abort();
			const controller = new AbortController();
			abortRef.current = controller;

			setIsLoading(true);
			setError(null);
			try {
				const result = await fetchAssets(
					normalizedPage,
					normalizedPageSizeValue,
					gpsFilter,
					albumID ?? undefined,
					{
						signal: controller.signal
					}
				);
				if (requestIDRef.current !== requestID) {
					return;
				}
				setAssets(result.items);
				setTotal(result.total);
				setCurrentPage(result.page);
			} catch (err) {
				if (controller.signal.aborted) {
					return;
				}
				if (requestIDRef.current !== requestID) {
					return;
				}
				setError(err instanceof Error ? err.message : 'Failed to load assets');
			} finally {
				if (requestIDRef.current === requestID) {
					setIsLoading(false);
				}
			}
		},
		[albumID, gpsFilter, pageSize]
	);

	const prevAlbumID = useRef(albumID);
	const prevGPSFilter = useRef(gpsFilter);
	const prevPageSize = useRef(pageSize);
	useEffect(() => {
		if (
			prevAlbumID.current !== albumID ||
			prevGPSFilter.current !== gpsFilter ||
			prevPageSize.current !== pageSize
		) {
			prevAlbumID.current = albumID;
			prevGPSFilter.current = gpsFilter;
			prevPageSize.current = pageSize;
			setAssets([]);
			setTotal(0);
			setCurrentPage(1);
			const page = focusPageRef?.current ?? 1;
			if (focusPageRef) {
				focusPageRef.current = null;
			}
			void loadPageAction(page);
		}
	}, [albumID, gpsFilter, pageSize, loadPageAction, focusPageRef]);

	useEffect(() => {
		return () => {
			abortRef.current?.abort();
		};
	}, []);

	const removeAsset = useCallback((assetID: string) => {
		setAssets(prev => {
			const next = prev.filter(a => a.immichID !== assetID);
			if (next.length === prev.length) {
				return prev;
			}
			setTotal(currentTotal => Math.max(0, currentTotal - 1));
			return next;
		});
	}, []);

	const clear = useCallback(() => {
		abortRef.current?.abort();
		abortRef.current = null;
		requestIDRef.current += 1;
		setAssets([]);
		setTotal(0);
		setCurrentPage(1);
		setIsLoading(false);
		setError(null);
	}, []);

	return {
		assets,
		total,
		currentPage,
		isLoading,
		error,
		removeAsset,
		loadPageAction,
		clear
	};
}
