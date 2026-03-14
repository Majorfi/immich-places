import {OVERVIEW_CLUSTER_SAME_POSITION_SPREAD_THRESHOLD} from '@/utils/map';

import type L from 'leaflet';
import type {RefObject} from 'react';

export type TAnchorMarker = L.Marker & {
	immichID?: string;
	groupMoveGhostMarkers?: {
		marker: L.Marker;
		originalOpacity: number;
		originalZIndexOffset: number;
		originalIcon?: L.Icon | L.DivIcon;
	}[];
	groupMoveSourceClusterIcon?: HTMLElement | null;
	groupMoveSourceCenter?: L.LatLng;
	groupMoveActionBar?: HTMLElement | null;
	groupMoveAssetIDs?: string[];
	groupMoveAssetCount?: number;
	groupMoveSourceMarkers?: (L.Marker & {immichID?: string})[];
	groupMoveStartCoordinatesByAssetID?: Map<string, L.LatLng>;
	groupMoveHiddenPendingMarkerElement?: HTMLElement | null;
	groupMoveHiddenPendingMarkerDisplay?: string | null;
	groupMoveHiddenPendingMarkerOpacity?: string | null;
	groupMoveHiddenPendingMarkerPointerEvents?: string | null;
	groupMoveHiddenPendingMarkerVisibility?: string | null;
};

type TLayerWithPosition = L.Layer & {
	getLatLng: () => L.LatLng;
	getElement?: () => HTMLElement | null | undefined;
	getChildCount?: () => number;
	immichID?: string;
};

type TClusterGroupWithVisibleParent = L.LayerGroup & {
	getVisibleParent?: (layer: L.Layer) => TLayerWithPosition | null;
};

function applyGroupMoveGhostStyle(markerElement: HTMLElement): void {
	markerElement.style.opacity = '0.2';
	markerElement.style.pointerEvents = 'none';
}

function clearGroupMoveLayerStyle(markerElement: HTMLElement): void {
	markerElement.style.removeProperty('opacity');
	markerElement.style.removeProperty('filter');
	markerElement.style.removeProperty('pointer-events');
}

function resolveLayerElement(layer: TLayerWithPosition | null): HTMLElement | null {
	if (!layer) {
		return null;
	}
	const publicElement = layer.getElement ? layer.getElement() : null;
	const privateElement = (layer as unknown as Record<string, unknown>)._icon;
	if (publicElement) {
		return publicElement;
	}
	return privateElement instanceof HTMLElement ? privateElement : null;
}

export function clearGroupMoveArtifacts(
	groupMovePillRef: RefObject<L.Marker | null>,
	groupAnchorMarkerRef: RefObject<L.Marker | null>,
	overviewLayerRef?: RefObject<L.LayerGroup | null>
): void {
	const anchorMarker = groupAnchorMarkerRef.current as TAnchorMarker | null;
	if (anchorMarker) {
		const ghostMarkers = anchorMarker.groupMoveGhostMarkers ?? [];
		for (const ghostMarker of ghostMarkers) {
			ghostMarker.marker.setOpacity(ghostMarker.originalOpacity);
			ghostMarker.marker.setZIndexOffset(ghostMarker.originalZIndexOffset);
			if (ghostMarker.originalIcon) {
				ghostMarker.marker.setIcon(ghostMarker.originalIcon);
			}
			const markerElement = ghostMarker.marker.getElement();
			if (markerElement) {
				clearGroupMoveLayerStyle(markerElement);
			}
		}
		if (anchorMarker.groupMoveSourceClusterIcon) {
			anchorMarker.groupMoveSourceClusterIcon.style.removeProperty('opacity');
			anchorMarker.groupMoveSourceClusterIcon.style.removeProperty('pointer-events');
		}
		if (anchorMarker.groupMoveActionBar) {
			const actionBarContainer = anchorMarker.groupMoveActionBar.parentElement;
			if (actionBarContainer) {
				actionBarContainer.removeChild(anchorMarker.groupMoveActionBar);
			}
		}
		anchorMarker.groupMoveSourceMarkers = [];
		if (overviewLayerRef?.current && anchorMarker.groupMoveAssetIDs) {
			clearGroupedMoveLayerStyles(overviewLayerRef.current, anchorMarker.groupMoveAssetIDs);
		}
		if (anchorMarker.groupMoveHiddenPendingMarkerElement) {
			const hiddenMarkerElement = anchorMarker.groupMoveHiddenPendingMarkerElement;
			const hiddenMarkerDisplay = anchorMarker.groupMoveHiddenPendingMarkerDisplay ?? '';
			if (hiddenMarkerDisplay === '') {
				hiddenMarkerElement.style.removeProperty('display');
			} else {
				hiddenMarkerElement.style.display = hiddenMarkerDisplay;
			}
			const hiddenMarkerOpacity = anchorMarker.groupMoveHiddenPendingMarkerOpacity ?? '';
			if (hiddenMarkerOpacity === '') {
				hiddenMarkerElement.style.removeProperty('opacity');
			} else {
				hiddenMarkerElement.style.opacity = hiddenMarkerOpacity;
			}
			const hiddenMarkerPointerEvents = anchorMarker.groupMoveHiddenPendingMarkerPointerEvents ?? '';
			if (hiddenMarkerPointerEvents === '') {
				hiddenMarkerElement.style.removeProperty('pointer-events');
			} else {
				hiddenMarkerElement.style.pointerEvents = hiddenMarkerPointerEvents;
			}
			const hiddenMarkerVisibility = anchorMarker.groupMoveHiddenPendingMarkerVisibility ?? '';
			if (hiddenMarkerVisibility === '') {
				hiddenMarkerElement.style.removeProperty('visibility');
			} else {
				hiddenMarkerElement.style.visibility = hiddenMarkerVisibility;
			}
			anchorMarker.groupMoveHiddenPendingMarkerElement = null;
			anchorMarker.groupMoveHiddenPendingMarkerDisplay = null;
			anchorMarker.groupMoveHiddenPendingMarkerOpacity = null;
			anchorMarker.groupMoveHiddenPendingMarkerPointerEvents = null;
			anchorMarker.groupMoveHiddenPendingMarkerVisibility = null;
		}
		anchorMarker.groupMoveGhostMarkers = [];
		anchorMarker.groupMoveStartCoordinatesByAssetID = undefined;
		anchorMarker.groupMoveSourceCenter = undefined;
		anchorMarker.groupMoveAssetCount = undefined;
		anchorMarker.groupMoveActionBar = null;
		anchorMarker.remove();
		groupAnchorMarkerRef.current = null;
	}
	const movePillMarker = groupMovePillRef.current;
	if (movePillMarker) {
		movePillMarker.remove();
	}
	groupMovePillRef.current = null;
}

function isLayerWithPosition(layer: L.Layer): layer is TLayerWithPosition {
	const maybeMarkerLayer = layer as L.Layer & {
		getLatLng?: () => L.LatLng;
		getElement?: () => HTMLElement | null | undefined;
		getChildCount?: () => number;
	};
	return typeof maybeMarkerLayer.getLatLng === 'function';
}

function clearGroupedMoveLayerStyles(overviewLayer: L.LayerGroup, assetIDs: string[]): void {
	const targetAssetIDs = new Set<string>(assetIDs);
	overviewLayer.eachLayer(layer => {
		if (!isLayerWithPosition(layer)) {
			return;
		}
		if (typeof layer.getElement !== 'function') {
			return;
		}
		const markerElement = layer.getElement();
		if (!markerElement) {
			return;
		}
		const markerAssetID = layer.immichID;
		if (!markerAssetID) {
			return;
		}
		if (!targetAssetIDs.has(markerAssetID)) {
			return;
		}
		clearGroupMoveLayerStyle(markerElement);
	});
}

export function restoreGroupMoveSourceClusterIcon(overviewLayer: L.LayerGroup, anchorMarker: TAnchorMarker): boolean {
	const sourceCenter = anchorMarker.groupMoveSourceCenter;
	if (!sourceCenter) {
		return false;
	}
	let didRestore = false;
	const maxRestoreDistanceMeters = OVERVIEW_CLUSTER_SAME_POSITION_SPREAD_THRESHOLD * 111000;
	let nearestDistance = Number.POSITIVE_INFINITY;
	let nearestLayerElement: HTMLElement | null = null;
	const targetAssetIDs = new Set<string>(anchorMarker.groupMoveAssetIDs ?? []);
	const sourceMarkers = anchorMarker.groupMoveSourceMarkers ?? [];
	const overviewClusterLayer = overviewLayer as TClusterGroupWithVisibleParent;
	for (const sourceMarker of sourceMarkers) {
		const sourceMarkerWithID = sourceMarker as TLayerWithPosition;
		const isMarkerMatch = Boolean(sourceMarkerWithID.immichID);
		if (!isMarkerMatch) {
			continue;
		}
		const visibleLayer = overviewClusterLayer.getVisibleParent
			? overviewClusterLayer.getVisibleParent(sourceMarker)
			: sourceMarker;
		const markerElement = resolveLayerElement(visibleLayer);
		if (!markerElement) {
			continue;
		}
		applyGroupMoveGhostStyle(markerElement);
		anchorMarker.groupMoveSourceClusterIcon = markerElement;
		didRestore = true;
	}
	if (didRestore) {
		return true;
	}
	overviewLayer.eachLayer(layer => {
		if (!isLayerWithPosition(layer)) {
			return;
		}
		const layerWithPosition = layer as TLayerWithPosition;
		const markerElement = resolveLayerElement(layerWithPosition);
		if (!markerElement) {
			return;
		}
		const markerAssetID = layerWithPosition.immichID;
		if (markerAssetID && targetAssetIDs.has(markerAssetID)) {
			applyGroupMoveGhostStyle(markerElement);
			anchorMarker.groupMoveSourceClusterIcon = markerElement;
			didRestore = true;
			return;
		}
		const markerLatLng = layerWithPosition.getLatLng();
		const markerDistance = markerLatLng.distanceTo(sourceCenter);
		if (markerDistance <= maxRestoreDistanceMeters && markerDistance < nearestDistance) {
			nearestDistance = markerDistance;
			nearestLayerElement = markerElement;
		}
	});
	if (!didRestore && nearestLayerElement) {
		applyGroupMoveGhostStyle(nearestLayerElement);
		anchorMarker.groupMoveSourceClusterIcon = nearestLayerElement;
		didRestore = true;
	}
	return didRestore;
}
