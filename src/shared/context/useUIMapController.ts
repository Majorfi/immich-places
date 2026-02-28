'use client';

import {useCallback, useState} from 'react';

import {useLightboxSelectionSync} from '@/features/lightbox/useLightboxSelectionSync';
import {useFocusMapAsset} from '@/features/map/hooks/useFocusMapAsset';

import type {TAssetRow} from '@/shared/types/asset';
import type {TUIMapController} from '@/shared/types/context';
import type {TGPSFilter} from '@/shared/types/map';
import type {TViewMode} from '@/shared/types/view';
import type {RefObject} from 'react';

type TUIMapControllerArgs = {
	gpsFilter: TGPSFilter;
	setGPSFilterRawAction: (filter: TGPSFilter) => void;
	viewMode: TViewMode;
	selectedAlbumID: string | null;
	selectAlbumAction: (albumID: string | null) => void;
	pageSize: number;
	loadPageAction: (page: number) => Promise<void>;
	selectedAssets: TAssetRow[];
	focusPageRef: RefObject<number | null>;
};
/**
 * Re-exported map UI controller type from shared context types.
 */
export type {TUIMapController} from '@/shared/types/context';

/**
 * Build map-related UI actions and focus state.
 *
 * Manages:
 * - Focused asset state for map/list sync
 * - Lightbox open/close/selection sync
 *
 * @param args - GPS/view selection state and paging callbacks.
 * @returns Map UI controller state and actions.
 */
export function useUIMapController({
	gpsFilter,
	setGPSFilterRawAction,
	viewMode,
	selectedAlbumID,
	selectAlbumAction,
	pageSize,
	loadPageAction,
	selectedAssets,
	focusPageRef
}: TUIMapControllerArgs): TUIMapController {
	const [focusedAssetID, setFocusedAssetID] = useState<string | null>(null);
	/**
	 * Clears focus marker state and prevents repeated refocus.
	 */
	const clearFocusedAssetAction = useCallback(() => {
		setFocusedAssetID(null);
	}, []);

	const [lightboxAssetID, setLightboxAssetID] = useState<string | null>(null);
	useLightboxSelectionSync(selectedAssets, lightboxAssetID, setLightboxAssetID);

	const closeLightboxAction = useCallback(() => {
		setLightboxAssetID(null);
	}, []);

	const focusMapAssetAction = useFocusMapAsset({
		gpsFilter,
		setGPSFilterRawAction,
		viewMode,
		selectedAlbumID,
		selectAlbumAction,
		closeLightboxAction,
		pageSize,
		loadPageAction,
		setFocusedAssetID,
		focusPageRef
	});

	/**
	 * Open lightbox for an asset and sync selected map/asset state.
	 *
	 * @param assetID - Target asset identifier.
	 */
	const openLightboxAction = useCallback((assetID: string) => {
		setLightboxAssetID(assetID);
	}, []);

	return {
		focusedAssetID,
		clearFocusedAssetAction,
		focusMapAssetAction,
		lightboxAssetID,
		openLightboxAction,
		closeLightboxAction
	};
}
