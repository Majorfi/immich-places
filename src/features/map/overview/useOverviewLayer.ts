'use client';

import {useMemo, useRef} from 'react';

import {useOverviewLayerFocusEffects} from '@/features/map/overview/useOverviewLayerFocusEffects';
import {useOverviewLayerReconcile} from '@/features/map/overview/useOverviewLayerReconcile';
import {useOverviewLayerSelectionSync} from '@/features/map/overview/useOverviewLayerSelectionSync';

import type {TMapMarker} from '@/shared/types/map';
import type {TUseOverviewLayerArgs} from '@/shared/types/mapLayer';

/**
 * Coordinates focus, reconcile, and selection synchronization for overview markers.
 *
 * @param args - Shared refs, assets, and callbacks required by map overview layer hooks.
 */
export function useOverviewLayer(args: TUseOverviewLayerArgs): void {
	const visibleMarkerIDsRef = useRef<Set<string>>(new Set());
	const previousSelectedIDsRef = useRef<Set<string>>(new Set());
	const markerDataByIDRef = useRef<Map<string, TMapMarker>>(new Map());
	const layerGreyscaleRef = useRef<boolean | null>(null);
	const selectedIDs = useMemo(() => new Set(args.selectedAssets.map(asset => asset.immichID)), [args.selectedAssets]);

	useOverviewLayerFocusEffects({
		selectedAssets: args.selectedAssets,
		pendingLocation: args.pendingLocation,
		focusedOverviewIDRef: args.focusedOverviewIDRef,
		focusedOverviewCoordsRef: args.focusedOverviewCoordsRef,
		overviewMarkersRef: args.overviewMarkersRef,
		gpsFilter: args.gpsFilter
	});

	useOverviewLayerReconcile({
		...args,
		visibleMarkerIDsRef,
		selectedIDs,
		markerDataByIDRef,
		layerGreyscaleRef
	});

	useOverviewLayerSelectionSync({
		selectedAssets: args.selectedAssets,
		overviewMarkersRef: args.overviewMarkersRef,
		previousSelectedIDsRef
	});
}
