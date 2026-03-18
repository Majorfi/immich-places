'use client';

import {useEffect} from 'react';

import type {TAssetRow} from '@/shared/types/asset';

type TUsePhotoGridFocusArgs = {
	focusedAssetID: string | null;
	assets: TAssetRow[];
	toggleAssetAction: (asset: TAssetRow, mode?: 'single' | 'additive') => void;
	clearFocusedAssetAction: () => void;
};

export function usePhotoGridFocusSelection({
	focusedAssetID,
	assets,
	toggleAssetAction,
	clearFocusedAssetAction
}: TUsePhotoGridFocusArgs): void {
	useEffect(() => {
		if (!focusedAssetID) {
			return;
		}
		const targetAsset = assets.find(asset => asset.immichID === focusedAssetID);
		if (!targetAsset) {
			return;
		}
		toggleAssetAction(targetAsset, 'single');
		clearFocusedAssetAction();
	}, [assets, focusedAssetID, toggleAssetAction, clearFocusedAssetAction]);
}
