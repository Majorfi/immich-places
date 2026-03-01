'use client';

import L from 'leaflet';
import {useEffect} from 'react';

import {createClusterIcon} from '@/features/map/overview/clusterIcon';
import {
	CLUSTER_MAX_RADIUS,
	CLUSTER_SPIDERFY_DISTANCE_MULTIPLIER,
	attachClusterEvents,
	resetLayerState
} from '@/features/map/overview/overviewLayerClusterSync';
import {syncMarkers} from '@/features/map/overview/overviewLayerMarkerSync';
import {thumbnailURL} from '@/utils/backendUrls';
import {isGPSFilterWithLocations} from '@/utils/view';

import type {TUseOverviewLayerReconcileArgs} from '@/shared/types/mapLayer';

/**
 * Reconciles overview-layer marker state with current map state and map-level options.
 *
 * Recreates cluster layers when greyscale or marker-mode changes and then
 * delegates marker reconciliation to shared sync helpers.
 *
 * @param args - Full overview layer reconcile argument set.
 */
export function useOverviewLayerReconcile({
	mapInstanceRef,
	albumFilter,
	gpsFilter,
	mapMarkers,
	pendingLocation,
	selectedAssets,
	clearSavedLocationsRef,
	toggleAssetRef,
	resolveAssetByIDRef,
	setLocationRef,
	openLightboxRef,
	hasSelectionRef,
	allSelectedHaveGPSRef,
	focusedOverviewIDRef,
	focusedOverviewCoordsRef,
	overviewMarkersRef,
	overviewLayerRef,
	isSpiderfiedRef,
	spiderCenterRef,
	groupMovePillRef,
	groupAnchorMarkerRef,
	visibleMarkerIDsRef,
	selectedIDs,
	selectedAssetIDsRef,
	markerDataByIDRef,
	layerGreyscaleRef,
	pendingLocationsByAssetID,
	savedLocationsByAssetID,
	pendingLocationsByAssetIDRef,
	savedLocationsByAssetIDRef,
	pendingSelectionMarkerRef
}: TUseOverviewLayerReconcileArgs): void {
	const isGreyscale = albumFilter !== 'gpx-import' && !isGPSFilterWithLocations(gpsFilter);

	useEffect(() => {
		if (!mapInstanceRef.current) {
			return;
		}
		if (mapMarkers.length === 0 && !overviewLayerRef.current) {
			return;
		}
		const shouldRecreateLayer =
			!overviewLayerRef.current ||
			layerGreyscaleRef.current === null ||
			layerGreyscaleRef.current !== isGreyscale;
		if (!shouldRecreateLayer) {
			return;
		}

		const map = mapInstanceRef.current;
		resetLayerState({
			overviewLayerRef,
			overviewMarkersRef,
			markerDataByIDRef,
			visibleMarkerIDsRef,
			focusedOverviewIDRef,
			focusedOverviewCoordsRef,
			layerGreyscaleRef,
			isSpiderfiedRef,
			spiderCenterRef,
			groupMovePillRef,
			groupAnchorMarkerRef
		});

		const clusterOptions: L.MarkerClusterGroupOptions & {
			elementsPlacementStrategy: 'concentric';
			helpingCircles: boolean;
		} = {
			maxClusterRadius: CLUSTER_MAX_RADIUS,
			showCoverageOnHover: false,
			spiderfyDistanceMultiplier: CLUSTER_SPIDERFY_DISTANCE_MULTIPLIER,
			zoomToBoundsOnClick: false,
			spiderfyOnMaxZoom: false,
			elementsPlacementStrategy: 'concentric',
			helpingCircles: false,
			iconCreateFunction(cluster) {
				const childMarkers = cluster.getAllChildMarkers();
				const count = childMarkers.length;
				const firstChild = childMarkers[0] as L.Marker & {immichID?: string};
				const thumbSrc = firstChild?.immichID ? thumbnailURL(firstChild.immichID) : '';
				return createClusterIcon({count, thumbnailSrc: thumbSrc, isGreyscale});
			}
		};
		const layer = L.markerClusterGroup(clusterOptions).addTo(map);

		attachClusterEvents(layer, map, {
			hasSelectionRef,
			allSelectedHaveGPSRef,
			setLocationRef,
			isSpiderfiedRef,
			spiderCenterRef,
			groupMovePillRef,
			groupAnchorMarkerRef,
			pendingSelectionMarkerRef
		});

		overviewLayerRef.current = layer;
		layerGreyscaleRef.current = isGreyscale;
		isSpiderfiedRef.current = false;
		spiderCenterRef.current = null;
	}, [
		isGreyscale,
		mapMarkers.length,
		mapInstanceRef,
		overviewLayerRef,
		layerGreyscaleRef,
		overviewMarkersRef,
		markerDataByIDRef,
		visibleMarkerIDsRef,
		focusedOverviewIDRef,
		focusedOverviewCoordsRef,
		hasSelectionRef,
		allSelectedHaveGPSRef,
		setLocationRef,
		groupMovePillRef,
		groupAnchorMarkerRef,
		pendingSelectionMarkerRef,
		isSpiderfiedRef,
		spiderCenterRef
	]);

	useEffect(() => {
		if (!overviewLayerRef.current) {
			return;
		}
		const markerSyncArgs: TUseOverviewLayerReconcileArgs = {
			mapInstanceRef,
			albumFilter,
			gpsFilter,
			mapMarkers,
			selectedAssets,
			pendingLocation,
			pendingSelectionMarkerRef,
			toggleAssetRef,
			resolveAssetByIDRef,
			setLocationRef,
			openLightboxRef,
			hasSelectionRef,
			allSelectedHaveGPSRef,
			focusedOverviewIDRef,
			focusedOverviewCoordsRef,
			overviewMarkersRef,
			overviewLayerRef,
			isSpiderfiedRef,
			spiderCenterRef,
			layerGreyscaleRef,
			visibleMarkerIDsRef,
			selectedIDs,
			selectedAssetIDsRef,
			groupMovePillRef,
			groupAnchorMarkerRef,
			markerDataByIDRef,
			pendingLocationsByAssetID,
			savedLocationsByAssetID,
			clearSavedLocationsRef,
			pendingLocationsByAssetIDRef,
			savedLocationsByAssetIDRef
		};
		const hasLayerChanges = syncMarkers(markerSyncArgs, isGreyscale);
		if (hasLayerChanges) {
			overviewLayerRef.current.refreshClusters();
		}
	}, [
		isGreyscale,
		mapMarkers,
		albumFilter,
		gpsFilter,
		mapInstanceRef,
		toggleAssetRef,
		resolveAssetByIDRef,
		setLocationRef,
		openLightboxRef,
		pendingLocation,
		selectedAssets,
		spiderCenterRef,
		hasSelectionRef,
		allSelectedHaveGPSRef,
		focusedOverviewIDRef,
		focusedOverviewCoordsRef,
		overviewMarkersRef,
		overviewLayerRef,
		groupMovePillRef,
		groupAnchorMarkerRef,
		isSpiderfiedRef,
		visibleMarkerIDsRef,
		selectedIDs,
		selectedAssetIDsRef,
		markerDataByIDRef,
		pendingLocationsByAssetID,
		savedLocationsByAssetID,
		clearSavedLocationsRef,
		pendingLocationsByAssetIDRef,
		savedLocationsByAssetIDRef,
		pendingSelectionMarkerRef,
		layerGreyscaleRef
	]);
}
