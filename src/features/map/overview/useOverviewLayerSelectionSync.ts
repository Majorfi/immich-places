'use client';

import {useEffect} from 'react';

import {overviewIcon} from '@/features/map/icons';

import type {TAssetRow} from '@/shared/types/asset';
import type L from 'leaflet';
import type {RefObject} from 'react';

type TUseOverviewLayerSelectionSyncArgs = {
	selectedAssets: TAssetRow[];
	overviewMarkersRef: RefObject<Map<string, L.Marker>>;
	previousSelectedIDsRef: RefObject<Set<string>>;
};

export function useOverviewLayerSelectionSync({
	selectedAssets,
	overviewMarkersRef,
	previousSelectedIDsRef
}: TUseOverviewLayerSelectionSyncArgs): void {
	useEffect(() => {
		const nextSelectedIDs = new Set(selectedAssets.map(a => a.immichID));
		const previousSelectedIDs = previousSelectedIDsRef.current;
		const changedIDs = new Set<string>();

		for (const assetID of nextSelectedIDs) {
			if (!previousSelectedIDs.has(assetID)) {
				changedIDs.add(assetID);
			}
		}
		for (const assetID of previousSelectedIDs) {
			if (!nextSelectedIDs.has(assetID)) {
				changedIDs.add(assetID);
			}
		}

		if (changedIDs.size === 0) {
			return;
		}
		for (const assetID of changedIDs) {
			const marker = overviewMarkersRef.current.get(assetID);
			if (!marker) {
				continue;
			}
			const isNowSelected = nextSelectedIDs.has(assetID);
			const isGreyscale = (marker as L.Marker & {markerGreyscale?: boolean}).markerGreyscale ?? false;
			marker.setIcon(overviewIcon(assetID, isNowSelected, isGreyscale));
		}
		previousSelectedIDsRef.current = nextSelectedIDs;
	}, [selectedAssets, overviewMarkersRef, previousSelectedIDsRef]);
}
