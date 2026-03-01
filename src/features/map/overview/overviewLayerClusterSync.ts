import * as L from 'leaflet';

import {clearGroupMoveArtifacts} from '@/features/map/groupMoveHelpers';
import {OVERVIEW_CLUSTER_ICON_SIZE, photoIcon} from '@/features/map/icons';
import {
	MAP_CONTROL_Z_INDEX,
	MAP_ICON_PRIMARY_COLOR,
	MAP_LOCATION_SOURCE_MAP_CLICK,
	MAP_LOCATION_SOURCE_MARKER_DRAG,
	MAP_OVERLAY_BOTTOM_WIDTH,
	OVERVIEW_CLUSTER_CLICK_PADDING,
	OVERVIEW_CLUSTER_CLICK_ZOOM,
	OVERVIEW_CLUSTER_MAX_RADIUS,
	OVERVIEW_CLUSTER_SAME_POSITION_SPREAD_THRESHOLD,
	OVERVIEW_CLUSTER_SPIDERFY_DISTANCE_MULTIPLIER
} from '@/utils/map';

import type {TAnchorMarker} from '@/features/map/groupMoveHelpers';
import type {TUseOverviewLayerReconcileArgs} from '@/shared/types/mapLayer';
import type {RefObject} from 'react';

type TLayerStateRefs = Pick<
	TUseOverviewLayerReconcileArgs,
	| 'overviewLayerRef'
	| 'overviewMarkersRef'
	| 'markerDataByIDRef'
	| 'visibleMarkerIDsRef'
	| 'focusedOverviewIDRef'
	| 'focusedOverviewCoordsRef'
	| 'layerGreyscaleRef'
	| 'isSpiderfiedRef'
	| 'spiderCenterRef'
	| 'groupMovePillRef'
	| 'groupAnchorMarkerRef'
>;

type TClusterEventArgs = Pick<
	TUseOverviewLayerReconcileArgs,
	| 'hasSelectionRef'
	| 'allSelectedHaveGPSRef'
	| 'setLocationRef'
	| 'isSpiderfiedRef'
	| 'spiderCenterRef'
	| 'groupMovePillRef'
	| 'groupAnchorMarkerRef'
	| 'pendingSelectionMarkerRef'
>;

type TGroupMoveModeRefs = Pick<TClusterEventArgs, 'groupMovePillRef' | 'groupAnchorMarkerRef'>;
type TGroupMoveStyleRefs = TGroupMoveModeRefs & Pick<TClusterEventArgs, 'pendingSelectionMarkerRef'>;

type TMarkerWithAssetID = L.Marker & {immichID?: string};
type TGhostedMarkerState = {
	marker: TMarkerWithAssetID;
	originalOpacity: number;
	originalZIndexOffset: number;
	originalIcon: L.Icon | L.DivIcon;
};
type TLeafletMarkerWithPrivateIcon = L.Marker & {_icon?: HTMLElement | null}; //eslint-disable-line
type TAnchorIcon = L.DivIcon;

/**
 * Maximum clustering radius forwarded from shared map constants.
 *
 * @defaultValue `OVERVIEW_CLUSTER_MAX_RADIUS`
 */
export const CLUSTER_MAX_RADIUS = OVERVIEW_CLUSTER_MAX_RADIUS;

/**
 * Spiderfier distance multiplier for marker clusters, forwarded from map config.
 *
 * @defaultValue `OVERVIEW_CLUSTER_SPIDERFY_DISTANCE_MULTIPLIER`
 */
export const CLUSTER_SPIDERFY_DISTANCE_MULTIPLIER = OVERVIEW_CLUSTER_SPIDERFY_DISTANCE_MULTIPLIER;

const GROUP_MOVE_HANDLE_SIZE_PX = OVERVIEW_CLUSTER_ICON_SIZE;

function resolveAnchorIcon(groupMarkers: TMarkerWithAssetID[]): TAnchorIcon | undefined {
	const sourceAssetIDs: string[] = [];
	for (const marker of groupMarkers) {
		const sourceAssetID = marker.immichID;
		if (!sourceAssetID) {
			continue;
		}
		if (!sourceAssetIDs.includes(sourceAssetID)) {
			sourceAssetIDs.push(sourceAssetID);
		}
	}
	if (sourceAssetIDs.length === 0) {
		return photoIcon([]);
	}
	return photoIcon(sourceAssetIDs);
}

function createGroupMoveGhostMarkers(groupMarkers: TMarkerWithAssetID[]): TGhostedMarkerState[] {
	const ghostMarkers: TGhostedMarkerState[] = [];
	for (const marker of groupMarkers) {
		if (!marker.immichID) {
			continue;
		}
		const markerIcon = marker.getIcon();
		if (!(markerIcon instanceof L.DivIcon)) {
			marker.setIcon(photoIcon([marker.immichID]));
		}
		const markerElement = marker.getElement();
		if (markerElement) {
			markerElement.style.opacity = '0.35';
			markerElement.style.pointerEvents = 'none';
			markerElement.style.filter = 'grayscale(0.18)';
		}
		ghostMarkers.push({
			marker,
			originalOpacity: marker.options.opacity ?? 1,
			originalZIndexOffset: marker.options.zIndexOffset ?? 0,
			originalIcon: markerIcon
		});
		marker.setOpacity(0.35);
		marker.setZIndexOffset(-1);
	}
	return ghostMarkers;
}

function hidePendingSelectionMarkerIfNeeded(
	pendingSelectionMarkerRef: RefObject<L.Marker | null> | undefined,
	anchorMarker: TAnchorMarker,
	attempts = 3
): void {
	if (!pendingSelectionMarkerRef?.current || attempts < 0) {
		return;
	}
	const markerElement = pendingSelectionMarkerRef.current.getElement();
	const pendingSelectionMarkerElement =
		markerElement ?? (pendingSelectionMarkerRef.current as TLeafletMarkerWithPrivateIcon)._icon;
	if (!pendingSelectionMarkerElement) {
		window.requestAnimationFrame(() => {
			hidePendingSelectionMarkerIfNeeded(pendingSelectionMarkerRef, anchorMarker, attempts - 1);
		});
		return;
	}
	anchorMarker.groupMoveHiddenPendingMarkerElement = pendingSelectionMarkerElement;
	anchorMarker.groupMoveHiddenPendingMarkerDisplay = pendingSelectionMarkerElement.style.display || '';
	anchorMarker.groupMoveHiddenPendingMarkerOpacity = pendingSelectionMarkerElement.style.opacity || '';
	anchorMarker.groupMoveHiddenPendingMarkerPointerEvents = pendingSelectionMarkerElement.style.pointerEvents || '';
	anchorMarker.groupMoveHiddenPendingMarkerVisibility = pendingSelectionMarkerElement.style.visibility || '';
	pendingSelectionMarkerElement.style.display = 'none';
	pendingSelectionMarkerElement.style.opacity = '0';
	pendingSelectionMarkerElement.style.pointerEvents = 'none';
	pendingSelectionMarkerElement.style.visibility = 'hidden';
}

function createGroupMoveActionBar(
	map: L.Map,
	anchorMarker: TAnchorMarker,
	setLocationRef: TClusterEventArgs['setLocationRef'],
	groupMoveRefs: TGroupMoveModeRefs
): HTMLElement {
	const mapContainer = map.getContainer();
	let assetCount = anchorMarker.groupMoveAssetCount ?? 0;
	if (anchorMarker.groupMoveAssetIDs) {
		assetCount = anchorMarker.groupMoveAssetIDs.length;
	}
	if (assetCount === 0 && anchorMarker.groupMoveStartCoordinatesByAssetID) {
		assetCount = anchorMarker.groupMoveStartCoordinatesByAssetID.size;
	}
	if (assetCount === 0 && anchorMarker.groupMoveSourceMarkers) {
		for (const marker of anchorMarker.groupMoveSourceMarkers) {
			if (marker.immichID) {
				assetCount = assetCount + 1;
			}
		}
	}
	if (assetCount === 0) {
		assetCount = 1;
	}
	const moveLabel = buildMovePillLabel(assetCount);
	const actionBar = document.createElement('div');
	actionBar.style.alignItems = 'center';
	actionBar.style.background = 'var(--color-surface)';
	actionBar.style.border = '1px solid var(--color-border)';
	actionBar.style.borderRadius = '8px';
	actionBar.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
	actionBar.style.display = 'flex';
	actionBar.style.flexDirection = 'row';
	actionBar.style.gap = '8px';
	actionBar.style.left = '50%';
	actionBar.style.padding = '10px 12px';
	actionBar.style.position = 'absolute';
	actionBar.style.pointerEvents = 'auto';
	actionBar.style.bottom = '16px';
	actionBar.style.transform = 'translateX(-50%)';
	actionBar.style.width = MAP_OVERLAY_BOTTOM_WIDTH;
	actionBar.style.zIndex = `${MAP_CONTROL_Z_INDEX + 1}`;
	mapContainer.appendChild(actionBar);
	L.DomEvent.disableClickPropagation(actionBar);
	L.DomEvent.disableScrollPropagation(actionBar);

	const title = document.createElement('div');
	title.style.display = 'flex';
	title.style.flex = '1';
	title.style.flexDirection = 'column';
	title.style.minWidth = '0';
	title.style.color = 'var(--color-text)';
	title.style.fontSize = '12px';
	title.style.fontWeight = '500';
	title.style.lineHeight = '1.2';
	title.style.overflow = 'hidden';
	title.textContent = `${moveLabel} to new position`;
	actionBar.appendChild(title);

	const buttonRow = document.createElement('div');
	buttonRow.style.display = 'flex';
	buttonRow.style.gap = '8px';
	buttonRow.style.justifyContent = 'flex-end';
	actionBar.appendChild(buttonRow);

	const createActionButton = (label: string, isPrimary: boolean): HTMLButtonElement => {
		const button = document.createElement('button');
		button.type = 'button';
		button.textContent = label;
		button.style.borderRadius = '6px';
		button.style.cursor = 'pointer';
		button.style.fontSize = '12px';
		button.style.fontWeight = '500';
		button.style.padding = '6px 12px';
		button.style.transition = 'opacity 150ms';
		button.style.pointerEvents = 'auto';
		button.style.whiteSpace = 'nowrap';
		if (isPrimary) {
			button.style.background = 'var(--color-primary)';
			button.style.border = '0';
			button.style.color = '#fff';
		} else {
			button.style.background = 'var(--color-bg)';
			button.style.border = '1px solid var(--color-border)';
			button.style.color = 'var(--color-text)';
		}
		return button;
	};

	const cancelButton = createActionButton('Cancel', false);
	const confirmButton = createActionButton('Apply group move', true);
	buttonRow.appendChild(cancelButton);
	buttonRow.appendChild(confirmButton);
	cancelButton.setAttribute('aria-label', 'Cancel group move');
	confirmButton.setAttribute('aria-label', 'Apply group move');

	cancelButton.addEventListener('click', () => {
		clearGroupMoveArtifacts(groupMoveRefs.groupMovePillRef, groupMoveRefs.groupAnchorMarkerRef);
	});

	confirmButton.addEventListener('click', () => {
		const sourceCenter = anchorMarker.groupMoveSourceCenter;
		const startCoordinatesByAssetID = anchorMarker.groupMoveStartCoordinatesByAssetID;
		if (!sourceCenter || !startCoordinatesByAssetID) {
			clearGroupMoveArtifacts(groupMoveRefs.groupMovePillRef, groupMoveRefs.groupAnchorMarkerRef);
			return;
		}
		const targetLatLng = anchorMarker.getLatLng();
		const deltaLatitude = targetLatLng.lat - sourceCenter.lat;
		const deltaLongitude = targetLatLng.lng - sourceCenter.lng;
		for (const [assetID, startLatLng] of startCoordinatesByAssetID.entries()) {
			const latitude = startLatLng.lat + deltaLatitude;
			const longitude = startLatLng.lng + deltaLongitude;
			setLocationRef.current({
				latitude,
				longitude,
				source: MAP_LOCATION_SOURCE_MARKER_DRAG,
				targetAssetIDs: [assetID],
				skipPendingLocation: true
			});
		}
		clearGroupMoveArtifacts(groupMoveRefs.groupMovePillRef, groupMoveRefs.groupAnchorMarkerRef);
	});

	return actionBar;
}

function resolveGroupMarkers(cluster: L.MarkerCluster): TMarkerWithAssetID[] {
	return cluster.getAllChildMarkers() as TMarkerWithAssetID[];
}

function resolveAssetCount(markers: TMarkerWithAssetID[]): number {
	const assetIDs = new Set<string>();
	for (const marker of markers) {
		if (marker.immichID) {
			assetIDs.add(marker.immichID);
		}
	}
	return assetIDs.size;
}

function buildMovePillLabel(assetCount: number): string {
	if (assetCount > 1) {
		return `Move ${assetCount} items`;
	}
	return 'Move 1 item';
}

function createGroupMoveHandleIcon(): L.DivIcon {
	const size = GROUP_MOVE_HANDLE_SIZE_PX;
	const iconContentStyle = [
		'width:100%',
		'height:100%',
		'border-radius:999px',
		`background:${MAP_ICON_PRIMARY_COLOR}`,
		'border:2px solid #fff',
		'box-shadow:0 4px 14px rgba(0, 0, 0, 0.25)',
		'display:flex',
		'align-items:center',
		'justify-content:center',
		'position:relative',
		'box-sizing:border-box'
	].join(';');
	const dragIconSizePx = Math.floor(size * 0.5);
	const dragIconWrapperStyle = [
		'display:flex',
		'align-items:center',
		'justify-content:center',
		`width:${dragIconSizePx}px`,
		`height:${dragIconSizePx}px`
	].join(';');
	return L.divIcon({
		className: '',
		iconSize: [size, size],
		iconAnchor: [size / 2, size / 2],
		html: `<div style="${iconContentStyle}">
			<div style="${dragIconWrapperStyle}">
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style="width:100%;height:100%;opacity:0.78">
					<path fill="#fff" fill-opacity="0.78" d="M342.6 73.4C330.1 60.9 309.8 60.9 297.3 73.4L233.3 137.4C220.8 149.9 220.8 170.2 233.3 182.7C245.8 195.2 266.1 195.2 278.6 182.7L288 173.3L288 288L173.3 288L182.7 278.6C195.2 266.1 195.2 245.8 182.7 233.3C170.2 220.8 149.9 220.8 137.4 233.3L73.4 297.3C60.9 309.8 60.9 330.1 73.4 342.6L137.4 406.6C149.9 419.1 170.2 419.1 182.7 406.6C195.2 394.1 195.2 373.8 182.7 361.3L173.3 351.9L288 351.9L288 466.6L278.6 457.2C266.1 444.7 245.8 444.7 233.3 457.2C220.8 469.7 220.8 490 233.3 502.5L297.3 566.5C309.8 579 330.1 579 342.6 566.5L406.6 502.5C419.1 490 419.1 469.7 406.6 457.2C394.1 444.7 373.8 444.7 361.3 457.2L351.9 466.6L351.9 351.9L466.6 351.9L457.2 361.3C444.7 373.8 444.7 394.1 457.2 406.6C469.7 419.1 490 419.1 502.5 406.6L566.5 342.6C579 330.1 579 309.8 566.5 297.3L502.5 233.3C490 220.8 469.7 220.8 457.2 233.3C444.7 245.8 444.7 266.1 457.2 278.6L466.6 288L351.9 288L351.9 173.3L361.3 182.7C373.8 195.2 394.1 195.2 406.6 182.7C419.1 170.2 419.1 149.9 406.6 137.4L342.6 73.4z"/>
				</svg>
			</div>
		</div>`
	});
}

function createGroupMoveHandle(
	map: L.Map,
	cluster: L.MarkerCluster,
	groupMarkers: TMarkerWithAssetID[],
	setLocationRef: TClusterEventArgs['setLocationRef'],
	groupMoveRefs: TGroupMoveStyleRefs
): void {
	const {groupMovePillRef} = groupMoveRefs;
	const clusterCenter = cluster.getLatLng();
	clearGroupMoveArtifacts(groupMovePillRef, groupMoveRefs.groupAnchorMarkerRef);
	const moveHandle = L.marker(clusterCenter, {
		icon: createGroupMoveHandleIcon(),
		zIndexOffset: 3200
	});
	groupMovePillRef.current = moveHandle;
	moveHandle.addTo(map);
	moveHandle.on('click', (event: L.LeafletMouseEvent) => {
		const domEvent = event.originalEvent;
		if (domEvent) {
			domEvent.preventDefault();
			domEvent.stopPropagation();
		}
		activateGroupMoveMode(map, cluster, groupMarkers, clusterCenter, setLocationRef, groupMoveRefs);
	});
}

function activateGroupMoveMode(
	map: L.Map,
	cluster: L.MarkerCluster,
	groupMarkers: TMarkerWithAssetID[],
	center: L.LatLng,
	setLocationRef: TClusterEventArgs['setLocationRef'],
	groupMoveRefs: TGroupMoveStyleRefs
): void {
	const {groupMovePillRef, groupAnchorMarkerRef} = groupMoveRefs;
	clearGroupMoveArtifacts(groupMovePillRef, groupAnchorMarkerRef);
	cluster.unspiderfy();

	const startCoordinatesByAssetID = new Map<string, L.LatLng>();
	for (const marker of groupMarkers) {
		if (!marker.immichID) {
			continue;
		}
		startCoordinatesByAssetID.set(marker.immichID, marker.getLatLng());
	}
	if (startCoordinatesByAssetID.size === 0) {
		return;
	}

	const ghostMarkers = createGroupMoveGhostMarkers(groupMarkers);
	const clusterIconElement = (cluster as unknown as Record<string, HTMLElement | null>)._icon ?? null;
	if (clusterIconElement) {
		clusterIconElement.style.opacity = '0.2';
	}

	const anchorIcon = resolveAnchorIcon(groupMarkers);
	const anchorMarker = L.marker(center, {
		draggable: true,
		icon: anchorIcon,
		zIndexOffset: 3000,
		opacity: 1
	});
	anchorMarker.addTo(map);
	hidePendingSelectionMarkerIfNeeded(groupMoveRefs.pendingSelectionMarkerRef, anchorMarker as TAnchorMarker);
	const wrappedAnchorMarker = anchorMarker as TAnchorMarker;
	wrappedAnchorMarker.groupMoveSourceClusterIcon = clusterIconElement;
	wrappedAnchorMarker.groupMoveGhostMarkers = ghostMarkers;
	wrappedAnchorMarker.groupMoveStartCoordinatesByAssetID = startCoordinatesByAssetID;
	wrappedAnchorMarker.groupMoveSourceCenter = center;
	wrappedAnchorMarker.groupMoveAssetIDs = Array.from(startCoordinatesByAssetID.keys());
	wrappedAnchorMarker.groupMoveAssetCount = startCoordinatesByAssetID.size;
	wrappedAnchorMarker.groupMoveSourceMarkers = groupMarkers;
	groupAnchorMarkerRef.current = wrappedAnchorMarker;
	wrappedAnchorMarker.groupMoveActionBar = createGroupMoveActionBar(
		map,
		wrappedAnchorMarker,
		setLocationRef,
		groupMoveRefs
	);
}

/**
 * Clears all overview-layer marker state and detaches existing marker layer objects.
 *
 * @param refs - Layer and selection refs used by the overview map controller.
 */
export function resetLayerState(refs: TLayerStateRefs): void {
	if (refs.overviewLayerRef.current) {
		refs.overviewLayerRef.current.remove();
		refs.overviewLayerRef.current = null;
	}
	refs.overviewMarkersRef.current.clear();
	refs.markerDataByIDRef.current.clear();
	refs.visibleMarkerIDsRef.current.clear();
	refs.focusedOverviewIDRef.current = null;
	refs.focusedOverviewCoordsRef.current = null;
	refs.layerGreyscaleRef.current = null;
	refs.isSpiderfiedRef.current = false;
	refs.spiderCenterRef.current = null;
	clearGroupMoveArtifacts(refs.groupMovePillRef, refs.groupAnchorMarkerRef);
}

/**
 * Attaches cluster event handlers to synchronize spiderfy and cluster click behavior.
 *
 * @param layer - Leaflet cluster layer.
 * @param map - Current Leaflet map instance.
 * @param clusterEventArgs - Shared state refs and callbacks used while interacting with clusters.
 */
export function attachClusterEvents(
	layer: L.MarkerClusterGroup,
	map: L.Map,
	{
		hasSelectionRef,
		allSelectedHaveGPSRef,
		setLocationRef,
		isSpiderfiedRef,
		spiderCenterRef,
		...groupMoveRefs
	}: TClusterEventArgs
): void {
	layer.on('spiderfied', (event: L.LeafletEvent) => {
		isSpiderfiedRef.current = true;
		const spiderEvent = event as L.LeafletEvent & {cluster: L.MarkerCluster};
		const center = spiderEvent.cluster.getBounds().getCenter();
		spiderCenterRef.current = {lat: center.lat, lng: center.lng};
	});

	layer.on('unspiderfied', () => {
		isSpiderfiedRef.current = false;
		spiderCenterRef.current = null;
	});

	layer.on('clusterclick', (event: L.LeafletEvent) => {
		const clusterEvent = event as L.LeafletMouseEvent & {layer: L.MarkerCluster};
		if (clusterEvent.originalEvent) {
			clusterEvent.originalEvent.preventDefault();
			clusterEvent.originalEvent.stopPropagation();
		}
		handleClusterClick(
			clusterEvent.layer,
			map,
			hasSelectionRef.current,
			allSelectedHaveGPSRef.current,
			setLocationRef,
			groupMoveRefs
		);
	});
}

/**
 * Detects if all points in cluster bounds are effectively at the same location.
 *
 * @param bounds - Cluster bounds.
 * @returns `true` when spread is below the clustering same-position threshold.
 */
function isSamePositionCluster(bounds: L.LatLngBounds): boolean {
	const spread = Math.max(bounds.getNorth() - bounds.getSouth(), bounds.getEast() - bounds.getWest());
	return spread < OVERVIEW_CLUSTER_SAME_POSITION_SPREAD_THRESHOLD;
}

/**
 * Handles a single cluster click and routes to zoom/spiderfy/select behaviors.
 *
 * @param cluster - Leaflet marker cluster clicked by the user.
 * @param map - Leaflet map instance.
 * @param hasSelection - Whether any marker is currently selected.
 * @param allSelectedHaveGPS - Whether all selected assets include GPS coordinates.
 * @param setLocationRef - Ref-based location setter callback.
 * @param groupMoveRefs - Refs used for move-group UI artifacts.
 */
function handleClusterClick(
	cluster: L.MarkerCluster,
	map: L.Map,
	hasSelection: boolean,
	allSelectedHaveGPS: boolean,
	setLocationRef: TClusterEventArgs['setLocationRef'],
	groupMoveRefs: TGroupMoveStyleRefs
): void {
	const bounds = cluster.getBounds();
	if (!isSamePositionCluster(bounds)) {
		clearGroupMoveArtifacts(groupMoveRefs.groupMovePillRef, groupMoveRefs.groupAnchorMarkerRef);
		cluster.zoomToBounds({padding: OVERVIEW_CLUSTER_CLICK_PADDING});
		return;
	}

	const center = bounds.getCenter();
	if (hasSelection && !allSelectedHaveGPS) {
		clearGroupMoveArtifacts(groupMoveRefs.groupMovePillRef, groupMoveRefs.groupAnchorMarkerRef);
		setLocationRef.current({latitude: center.lat, longitude: center.lng, source: MAP_LOCATION_SOURCE_MAP_CLICK});
		return;
	}

	if (map.getZoom() >= OVERVIEW_CLUSTER_CLICK_ZOOM) {
		clearGroupMoveArtifacts(groupMoveRefs.groupMovePillRef, groupMoveRefs.groupAnchorMarkerRef);
		cluster.spiderfy();
		const groupMarkers = resolveGroupMarkers(cluster);
		if (resolveAssetCount(groupMarkers) > 1) {
			createGroupMoveHandle(map, cluster, groupMarkers, setLocationRef, groupMoveRefs);
		}
		return;
	}
	map.flyTo(center, OVERVIEW_CLUSTER_CLICK_ZOOM);
}
