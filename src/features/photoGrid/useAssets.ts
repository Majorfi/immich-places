'use client';

import {useCallback, useEffect, useRef, useState} from 'react';

import {fetchAssets, getFolderAssets} from '@/shared/services/backendApi';
import {normalizePositiveInteger} from '@/utils/math';
import {DEFAULT_PAGE_SIZE} from '@/utils/view';

import type {TAssetRow, TPaginatedAssets} from '@/shared/types/asset';
import type {TGPSFilter, THiddenFilter} from '@/shared/types/map';
import type {MutableRefObject} from 'react';

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

export function useAssets(
	gpsFilter: TGPSFilter,
	hiddenFilter: THiddenFilter,
	pageSize: number,
	albumID?: string | null,
	tagID?: string | null,
	startDate?: string | null,
	endDate?: string | null,
	folderPath?: string | null,
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
				let result: TPaginatedAssets;
				if (folderPath) {
					result = await getFolderAssets(
						folderPath,
						gpsFilter,
						hiddenFilter,
						normalizedPage,
						normalizedPageSizeValue,
						{
							signal: controller.signal
						}
					);
				} else {
					result = await fetchAssets(
						normalizedPage,
						normalizedPageSizeValue,
						gpsFilter,
						hiddenFilter,
						albumID ?? undefined,
						tagID ?? undefined,
						startDate ?? undefined,
						endDate ?? undefined,
						{
							signal: controller.signal
						}
					);
				}
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
				if (err instanceof Error) {
					setError(err.message);
				} else {
					setError('Failed to load assets');
				}
			} finally {
				if (requestIDRef.current === requestID) {
					setIsLoading(false);
				}
			}
		},
		[albumID, tagID, gpsFilter, hiddenFilter, startDate, endDate, folderPath, pageSize]
	);

	const prevAlbumID = useRef(albumID);
	const prevTagID = useRef(tagID);
	const prevGPSFilter = useRef(gpsFilter);
	const prevHiddenFilter = useRef(hiddenFilter);
	const prevPageSize = useRef(pageSize);
	const prevStartDate = useRef(startDate);
	const prevEndDate = useRef(endDate);
	const prevFolderPath = useRef(folderPath);
	useEffect(() => {
		if (
			prevAlbumID.current !== albumID ||
			prevTagID.current !== tagID ||
			prevGPSFilter.current !== gpsFilter ||
			prevHiddenFilter.current !== hiddenFilter ||
			prevPageSize.current !== pageSize ||
			prevStartDate.current !== startDate ||
			prevEndDate.current !== endDate ||
			prevFolderPath.current !== folderPath
		) {
			prevAlbumID.current = albumID;
			prevTagID.current = tagID;
			prevGPSFilter.current = gpsFilter;
			prevHiddenFilter.current = hiddenFilter;
			prevPageSize.current = pageSize;
			prevStartDate.current = startDate;
			prevEndDate.current = endDate;
			prevFolderPath.current = folderPath;
			setAssets([]);
			setTotal(0);
			setCurrentPage(1);
			const page = focusPageRef?.current ?? 1;
			if (focusPageRef) {
				focusPageRef.current = null;
			}
			void loadPageAction(page);
		}
	}, [
		albumID,
		tagID,
		gpsFilter,
		hiddenFilter,
		pageSize,
		startDate,
		endDate,
		folderPath,
		loadPageAction,
		focusPageRef
	]);

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
