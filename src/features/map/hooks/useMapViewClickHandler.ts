'use client';

import {useEffect} from 'react';

import {clearGroupMoveArtifacts, restoreGroupMoveSourceClusterIcon} from '@/features/map/groupMoveHelpers';
import {MAP_LOCATION_SOURCE_MAP_CLICK} from '@/utils/map';

import type {TAnchorMarker} from '@/features/map/groupMoveHelpers';
import type {TSetLocationOptions} from '@/shared/types/map';
import type L from 'leaflet';
import type {RefObject} from 'react';

type TUseMapClickHandlerArgs = {
	mapInstanceRef: RefObject<L.Map | null>;
	focusedOverviewIDRef: RefObject<string | null>;
	overviewMarkersRef: RefObject<Map<string, L.Marker>>;
	overviewLayerRef: RefObject<L.MarkerClusterGroup | null>;
	focusedOverviewCoordsRef: RefObject<{lat: number; lng: number} | null>;
	isSpiderfiedRef: RefObject<boolean>;
	groupMovePillRef: RefObject<L.Marker | null>;
	groupAnchorMarkerRef: RefObject<L.Marker | null>;
	hasSelectionRef: RefObject<boolean>;
	clearSelectionAction: () => void;
	closeLightboxAction: () => void;
	setLocationRef: RefObject<(options: TSetLocationOptions) => void>;
};

/**
 * Registers map click behavior for focus/selection, group move mode and cleanup.
 */
export function useMapClickHandler({
	mapInstanceRef,
	focusedOverviewIDRef,
	overviewMarkersRef,
	overviewLayerRef,
	focusedOverviewCoordsRef,
	isSpiderfiedRef,
	groupMovePillRef,
	groupAnchorMarkerRef,
	hasSelectionRef,
	clearSelectionAction,
	closeLightboxAction,
	setLocationRef
}: TUseMapClickHandlerArgs): void {
	useEffect(() => {
		if (!mapInstanceRef.current) {
			return;
		}
		const map = mapInstanceRef.current;

		function scheduleMoveModeSourceRestore(): void {
			let remainingAttempts = 8;
			const attemptRestore = (): void => {
				if (!groupAnchorMarkerRef.current || !overviewLayerRef.current) {
					return;
				}
				const anchorMarker = groupAnchorMarkerRef.current as TAnchorMarker;
				if (
					restoreGroupMoveSourceClusterIcon(overviewLayerRef.current, anchorMarker) ||
					remainingAttempts <= 0
				) {
					return;
				}
				remainingAttempts = remainingAttempts - 1;
				window.requestAnimationFrame(attemptRestore);
			};
			window.requestAnimationFrame(() => {
				window.requestAnimationFrame(attemptRestore);
			});
		}

		function handleClick(e: L.LeafletMouseEvent): void {
			const anchorMarker = groupAnchorMarkerRef.current as TAnchorMarker | null;
			if (anchorMarker) {
				anchorMarker.setLatLng(e.latlng);
				if (overviewLayerRef.current) {
					scheduleMoveModeSourceRestore();
				}
				return;
			}
			if (groupMovePillRef.current || groupAnchorMarkerRef.current) {
				clearGroupMoveArtifacts(groupMovePillRef, groupAnchorMarkerRef, overviewLayerRef);
				return;
			}
			if (isSpiderfiedRef.current && overviewLayerRef.current) {
				const activeClusterLayer = overviewLayerRef.current as L.MarkerClusterGroup & {unspiderfy: () => void};
				activeClusterLayer.unspiderfy();
				return;
			}
			if (focusedOverviewIDRef.current) {
				setLocationRef.current({
					latitude: e.latlng.lat,
					longitude: e.latlng.lng,
					source: MAP_LOCATION_SOURCE_MAP_CLICK,
					targetAssetIDs: [focusedOverviewIDRef.current],
					shouldSkipPendingLocation: true
				});
				focusedOverviewCoordsRef.current = {lat: e.latlng.lat, lng: e.latlng.lng};
				return;
			}
			if (hasSelectionRef.current) {
				setLocationRef.current({
					latitude: e.latlng.lat,
					longitude: e.latlng.lng,
					source: MAP_LOCATION_SOURCE_MAP_CLICK
				});
			}
		}

		function handleMoveModeRefresh(): void {
			const anchorMarker = groupAnchorMarkerRef.current as TAnchorMarker | null;
			if (!anchorMarker || !overviewLayerRef.current) {
				return;
			}
			scheduleMoveModeSourceRestore();
		}

		map.on('click', handleClick);
		map.on('zoomend', handleMoveModeRefresh);
		map.on('moveend', handleMoveModeRefresh);
		map.on('viewreset', handleMoveModeRefresh);
		return () => {
			map.off('click', handleClick);
			map.off('zoomend', handleMoveModeRefresh);
			map.off('moveend', handleMoveModeRefresh);
			map.off('viewreset', handleMoveModeRefresh);
			clearGroupMoveArtifacts(groupMovePillRef, groupAnchorMarkerRef, overviewLayerRef);
		};
	}, [
		isSpiderfiedRef,
		groupAnchorMarkerRef,
		hasSelectionRef,
		clearSelectionAction,
		closeLightboxAction,
		groupMovePillRef,
		focusedOverviewCoordsRef,
		focusedOverviewIDRef,
		overviewLayerRef,
		mapInstanceRef,
		overviewMarkersRef,
		setLocationRef
	]);
}
