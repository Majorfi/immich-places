'use client';

import {useCallback, useEffect, useRef} from 'react';

import {resolveFocusTarget} from '@/features/map/hooks/useFocusMapAsset.flow';
import {isAbortError} from '@/utils/abort';
import {GPS_FILTER_WITH_GPS} from '@/utils/view';

import type {TGPSFilter} from '@/shared/types/map';
import type {TViewMode} from '@/shared/types/view';
import type {MutableRefObject} from 'react';

type TUseFocusMapAssetArgs = {
	gpsFilter: TGPSFilter;
	setGPSFilterRawAction: (filter: TGPSFilter) => void;
	viewMode: TViewMode;
	selectedAlbumID: string | null;
	selectedTagID: string | null;
	selectAlbumAction: (albumID: string | null) => void;
	closeLightboxAction: () => void;
	pageSize: number;
	loadPageAction: (page: number) => Promise<void>;
	setFocusedAssetID: (assetID: string | null) => void;
	focusPageRef: MutableRefObject<number | null>;
};

/**
 * Creates a stable async callback that focuses the map on a specific asset.
 *
 * Resolves the target page/album, applies GPS filtering, updates focused IDs,
 * and safely handles cancellation of in-flight focus requests.
 *
 * @param args - View mode, filters, and mutation callbacks for focus flow.
 * @returns A memoized async callback that focuses an asset by ID.
 */
export function useFocusMapAsset({
	gpsFilter,
	setGPSFilterRawAction,
	viewMode,
	selectedAlbumID,
	selectedTagID,
	selectAlbumAction,
	closeLightboxAction,
	pageSize,
	loadPageAction,
	setFocusedAssetID,
	focusPageRef
}: TUseFocusMapAssetArgs): (assetID: string) => Promise<void> {
	const focusRequestIDRef = useRef(0);
	const focusAbortRef = useRef<AbortController | null>(null);

	useEffect(() => {
		return () => {
			focusAbortRef.current?.abort();
		};
	}, []);

	return useCallback(
		async (assetID: string) => {
			focusRequestIDRef.current += 1;
			const requestID = focusRequestIDRef.current;
			focusAbortRef.current?.abort();
			const controller = new AbortController();
			focusAbortRef.current = controller;

			try {
				const target = await resolveFocusTarget({
					assetID,
					pageSize,
					viewMode,
					selectedAlbumID,
					selectedTagID,
					signal: controller.signal
				});
				if (focusRequestIDRef.current !== requestID) {
					return;
				}

				if (gpsFilter !== GPS_FILTER_WITH_GPS) {
					setGPSFilterRawAction(GPS_FILTER_WITH_GPS);
				}
				setFocusedAssetID(assetID);

				if (target.requiresAlbumSwitch && target.albumID) {
					focusPageRef.current = target.page;
					closeLightboxAction();
					selectAlbumAction(target.albumID);
					return;
				}

				await loadPageAction(target.page);
			} catch (error) {
				if (isAbortError(error)) {
					return;
				}
				if (focusRequestIDRef.current !== requestID) {
					return;
				}
				setFocusedAssetID(null);
			}
		},
		[
			gpsFilter,
			setGPSFilterRawAction,
			viewMode,
			selectedAlbumID,
			selectedTagID,
			selectAlbumAction,
			closeLightboxAction,
			pageSize,
			loadPageAction,
			setFocusedAssetID,
			focusPageRef
		]
	);
}
