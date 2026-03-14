import L from 'leaflet';

import {clearGroupMoveArtifacts} from '@/features/map/groupMoveHelpers';
import {overviewIcon} from '@/features/map/icons';
import {
	MAP_FIT_SAME_SPOT_MAX_ZOOM,
	MAP_FLY_DURATION_SECONDS,
	MAP_LOCATION_SOURCE_MAP_CLICK,
	MAP_LOCATION_SOURCE_MARKER_DRAG
} from '@/utils/map';

import type {TMapMarker} from '@/shared/types/map';
import type {TUseOverviewLayerReconcileArgs} from '@/shared/types/mapLayer';

type TBuildMarkerArgs = {
	assetID: string;
	markerData: TMapMarker;
	isGreyscale: boolean;
	args: TUseOverviewLayerReconcileArgs;
	map: L.Map;
};

/**
 * Arguments required when dispatching a marker click handler.
 */
type TMarkerClickArgs = Omit<TBuildMarkerArgs, 'args'>;

/**
 * Runtime drag state carried for each marker while interacting with drag events.
 */
type TMarkerDragState = {wasDragged: boolean};

/**
 * Deterministic marker interaction action while syncing overview markers.
 */
type TMarkerClickAction = 'assign-location' | 'open-lightbox' | 'focus-marker' | 'update-focus-marker' | 'blur-marker';

/**
 * Runtime marker coordinate used for rendering and sync.
 */
type TMarkerRenderData = {
	immichID: string;
	latitude: number;
	longitude: number;
};

type TLayerWithElement = L.Layer & {
	getElement: () => HTMLElement | null | undefined;
};

/**
 * Synchronizes all map markers against backend data and selection visibility.
 *
 * Creates missing markers, updates existing marker state, and removes stale markers
 * from the overlay and caches.
 *
 * @param args - Refs and callbacks from overview layer controller.
 * @param isGreyscale - Whether map should display non-selected markers in greyscale.
 * @returns `true` when any marker/layer mutation occurred.
 */
export function syncMarkers(args: TUseOverviewLayerReconcileArgs, isGreyscale: boolean): boolean {
	if (!args.mapInstanceRef.current || !args.overviewLayerRef.current) {
		return false;
	}
	const map = args.mapInstanceRef.current;
	const nextMarkerDataByID = buildNextMarkerDataByID(args.mapMarkers);
	args.markerDataByIDRef.current = nextMarkerDataByID;

	if (!args.groupMovePillRef.current && !args.groupAnchorMarkerRef.current && args.overviewLayerRef.current) {
		clearGroupMoveInlineStyles(args.overviewLayerRef.current);
	}

	let hasLayerChanges = removeStaleMarkers(args, nextMarkerDataByID);

	for (const markerData of args.mapMarkers) {
		if (syncSingleMarker(args, map, markerData, isGreyscale)) {
			hasLayerChanges = true;
		}
	}

	return hasLayerChanges;
}

function clearGroupMoveInlineStyles(overviewLayer: L.LayerGroup): void {
	overviewLayer.eachLayer(layer => {
		const markerLayer = layer as TLayerWithElement;
		if (typeof markerLayer.getElement !== 'function') {
			return;
		}
		const markerElement = markerLayer.getElement();
		if (!markerElement) {
			return;
		}
		markerElement.style.removeProperty('opacity');
		markerElement.style.removeProperty('filter');
		markerElement.style.removeProperty('pointer-events');
	});
}

/**
 * Removes markers that no longer exist in current backend data.
 *
 * @param args - Layer refs used by overview synchronization.
 * @param nextMarkerDataByID - Latest marker payload map.
 * @returns `true` if any stale marker was detached.
 */
function removeStaleMarkers(
	args: TUseOverviewLayerReconcileArgs,
	nextMarkerDataByID: Map<string, TMapMarker>
): boolean {
	const {overviewLayerRef, overviewMarkersRef, visibleMarkerIDsRef, focusedOverviewIDRef, focusedOverviewCoordsRef} =
		args;
	let hasLayerChanges = false;

	for (const [assetID, marker] of overviewMarkersRef.current.entries()) {
		if (nextMarkerDataByID.has(assetID)) {
			continue;
		}
		if (visibleMarkerIDsRef.current.has(assetID)) {
			overviewLayerRef.current?.removeLayer(marker);
		}
		overviewMarkersRef.current.delete(assetID);
		visibleMarkerIDsRef.current.delete(assetID);
		if (focusedOverviewIDRef.current === assetID) {
			focusedOverviewIDRef.current = null;
			focusedOverviewCoordsRef.current = null;
		}
		hasLayerChanges = true;
	}

	return hasLayerChanges;
}

function resolveMarkerGreyscale(args: TUseOverviewLayerReconcileArgs, assetID: string, isGreyscale: boolean): boolean {
	if (isGreyscale) {
		return true;
	}
	return Boolean(args.pendingLocationsByAssetIDRef.current[assetID]?.isAlreadyApplied);
}

/**
 * Synchronizes a single marker for visibility, position, and icon state.
 *
 * @param args - Refs and callbacks for marker mutations.
 * @param map - Leaflet map instance.
 * @param markerData - Marker payload from server.
 * @param isGreyscale - Whether to render as greyscale when possible.
 * @returns `true` when at least one marker field changed.
 */
function syncSingleMarker(
	args: TUseOverviewLayerReconcileArgs,
	map: L.Map,
	markerData: TMapMarker,
	isGreyscale: boolean
): boolean {
	const assetID = markerData.immichID;
	const isMarkerVisible = true;
	const renderedMarkerData = resolveMarkerData(args, assetID, markerData);
	const hasEffectiveGreyscale = resolveMarkerGreyscale(args, assetID, isGreyscale);
	clearOptimisticSavedLocation(args, assetID, markerData);

	if (createMarkerIfMissing(args, map, renderedMarkerData, hasEffectiveGreyscale, isMarkerVisible)) {
		return true;
	}

	const existingMarker = args.overviewMarkersRef.current.get(assetID);
	if (!existingMarker) {
		return false;
	}

	let hasChanges = false;
	if (syncMarkerIcon(args, existingMarker, assetID, hasEffectiveGreyscale)) {
		hasChanges = true;
	}
	if (syncMarkerPosition(args, existingMarker, assetID, renderedMarkerData)) {
		hasChanges = true;
	}
	if (syncMarkerVisibility(args, existingMarker, assetID, isMarkerVisible)) {
		hasChanges = true;
	}
	return hasChanges;
}

/**
 * Creates marker when absent, restoring it to the selected visibility bucket.
 *
 * @param args - Shared marker refs and callbacks.
 * @param map - Leaflet map instance.
 * @param markerData - Marker payload.
 * @param isGreyscale - Greyscale render mode for marker icon.
 * @param isMarkerVisible - Indicates whether marker should be shown.
 * @returns `true` when a new marker was inserted.
 */
function createMarkerIfMissing(
	args: TUseOverviewLayerReconcileArgs,
	map: L.Map,
	markerData: TMarkerRenderData,
	isGreyscale: boolean,
	isMarkerVisible: boolean
): boolean {
	const assetID = markerData.immichID;
	const existingMarker = args.overviewMarkersRef.current.get(assetID);
	if (existingMarker) {
		return false;
	}
	const marker = buildMarker({assetID, markerData, isGreyscale, args, map});
	args.overviewMarkersRef.current.set(assetID, marker);
	if (isMarkerVisible) {
		args.overviewLayerRef.current?.addLayer(marker);
		args.visibleMarkerIDsRef.current.add(assetID);
	}
	return true;
}

/**
 * Constructs a marker instance and attaches drag/click handlers.
 *
 * @param params - Marker creation inputs.
 * @returns Configured Leaflet marker.
 */
function buildMarker({assetID, markerData, isGreyscale, args, map}: TBuildMarkerArgs): L.Marker {
	const marker = createOverviewMarker(assetID, markerData, args, isGreyscale);
	const dragState: TMarkerDragState = {wasDragged: false};
	attachDragHandlers(marker, args, assetID, dragState);
	attachClickHandlers(marker, args, map, assetID, isGreyscale, dragState);
	return marker;
}

/**
 * Creates the base overview marker for a given asset and initial selection state.
 *
 * @param assetID - Asset identifier.
 * @param markerData - Marker data from backend.
 * @param args - Sync args and callbacks.
 * @param isGreyscale - Whether to render the marker in greyscale.
 * @returns A Leaflet marker configured with thumbnail icon.
 */
function createOverviewMarker(
	assetID: string,
	markerData: TMarkerRenderData,
	args: TUseOverviewLayerReconcileArgs,
	isGreyscale: boolean
): L.Marker {
	const marker = L.marker(L.latLng(markerData.latitude, markerData.longitude), {
		icon: overviewIcon(assetID, args.selectedAssetIDsRef.current.has(assetID), isGreyscale),
		zIndexOffset: 0,
		draggable: true
	});
	(marker as L.Marker & {immichID: string; markerGreyscale: boolean}).immichID = assetID;
	(marker as L.Marker & {markerGreyscale: boolean}).markerGreyscale = isGreyscale;
	return marker;
}

/**
 * Adds drag handlers for existing markers.
 *
 * Dragging updates the selected location and keeps marker refs synchronized.
 *
 * @param marker - Marker to attach handlers to.
 * @param args - Controller refs and actions.
 * @param assetID - Asset identifier.
 * @param dragState - Mutable drag state.
 */
function attachDragHandlers(
	marker: L.Marker,
	args: TUseOverviewLayerReconcileArgs,
	assetID: string,
	dragState: TMarkerDragState
): void {
	marker.on('dragstart', () => {
		dragState.wasDragged = true;
	});

	marker.on('dragend', (event: L.DragEndEvent) => {
		const newLatLng = (event.target as L.Marker).getLatLng();
		const selectedAssetIDs = args.selectedAssetIDsRef ? args.selectedAssetIDsRef.current : null;
		const targetAssetIDs = selectedAssetIDs?.has(assetID) ? [...selectedAssetIDs] : [assetID];
		args.setLocationRef.current({
			latitude: newLatLng.lat,
			longitude: newLatLng.lng,
			source: MAP_LOCATION_SOURCE_MARKER_DRAG,
			targetAssetIDs,
			shouldSkipPendingLocation: true
		});
		clearGroupMoveArtifacts(args.groupMovePillRef, args.groupAnchorMarkerRef, args.overviewLayerRef);
	});
}

/**
 * Adds click handlers that dispatch to location assignment / focus / open-lightbox.
 *
 * @param marker - Target marker.
 * @param args - Marker sync args.
 * @param map - Map instance for focusing.
 * @param assetID - Asset identifier.
 * @param isGreyscale - Current greyscale flag.
 * @param dragState - Drag state to distinguish drag completion.
 */
function attachClickHandlers(
	marker: L.Marker,
	args: TUseOverviewLayerReconcileArgs,
	map: L.Map,
	assetID: string,
	isGreyscale: boolean,
	dragState: TMarkerDragState
): void {
	marker.on('click', (event: L.LeafletMouseEvent) => {
		const latestMarkerData = args.markerDataByIDRef.current.get(assetID);
		if (!latestMarkerData) {
			return;
		}
		if (dragState.wasDragged) {
			dragState.wasDragged = false;
			return;
		}
		L.DomEvent.stopPropagation(event);
		const isClickGreyscale = resolveMarkerGreyscale(args, assetID, isGreyscale);
		handleMarkerClick(args, marker, {
			assetID,
			markerData: resolveMarkerData(args, assetID, latestMarkerData),
			isGreyscale: isClickGreyscale,
			map
		});
	});

	marker.on('contextmenu', (event: L.LeafletMouseEvent) => {
		if (event.originalEvent) {
			event.originalEvent.preventDefault();
			event.originalEvent.stopPropagation();
		}
		args.openContextMenuRef.current({
			type: 'marker',
			x: event.originalEvent.clientX,
			y: event.originalEvent.clientY,
			assetID
		});
	});
}

/**
 * Resolves and applies marker click action based on selection and interaction state.
 *
 * @param args - Shared marker args.
 * @param marker - Clicked marker.
 * @param params - Action payload.
 */
function handleMarkerClick(args: TUseOverviewLayerReconcileArgs, marker: L.Marker, params: TMarkerClickArgs): void {
	const {assetID, markerData} = params;
	switch (resolveMarkerClickAction(args, assetID)) {
		case 'assign-location':
			args.setLocationRef.current({
				latitude: markerData.latitude,
				longitude: markerData.longitude,
				source: MAP_LOCATION_SOURCE_MAP_CLICK,
				targetAssetIDs: Array.from(args.selectedAssetIDsRef.current)
			});
			args.focusedOverviewIDRef.current = assetID;
			args.focusedOverviewCoordsRef.current = {lat: markerData.latitude, lng: markerData.longitude};
			return;
		case 'open-lightbox':
			args.openLightboxRef.current(assetID);
			return;
		case 'focus-marker': {
			const assetRow = args.resolveAssetByIDRef.current(assetID);
			if (assetRow) {
				args.toggleAssetRef.current(assetRow, 'single');
			}
			focusMarker(args, marker, assetID, markerData, params.isGreyscale);
			if (params.map.getZoom() < MAP_FIT_SAME_SPOT_MAX_ZOOM) {
				params.map.flyTo([markerData.latitude, markerData.longitude], MAP_FIT_SAME_SPOT_MAX_ZOOM, {
					duration: MAP_FLY_DURATION_SECONDS
				});
			}
			return;
		}
		case 'update-focus-marker': {
			for (const selectedID of args.selectedAssetIDsRef.current) {
				const selectedMarker = args.overviewMarkersRef.current.get(selectedID);
				if (selectedMarker) {
					selectedMarker.setIcon(overviewIcon(selectedID, false, params.isGreyscale));
				}
			}
			const assetRow = args.resolveAssetByIDRef.current(assetID);
			if (assetRow) {
				args.toggleAssetRef.current(assetRow, 'single');
			}
			focusMarker(args, marker, assetID, markerData, params.isGreyscale);
			return;
		}
		case 'blur-marker': {
			const assetRow = args.resolveAssetByIDRef.current(assetID);
			if (assetRow) {
				args.toggleAssetRef.current(assetRow, 'single');
			}
			marker.setIcon(overviewIcon(assetID, false, params.isGreyscale));
			clearFocusedMarker(args, assetID);
			return;
		}
	}
}

/**
 * Derives click behavior from selection + cluster/spider state.
 *
 * @param args - Shared marker args.
 * @param assetID - Marker's asset identifier.
 * @returns The action to apply for this marker click.
 */
function resolveMarkerClickAction(args: TUseOverviewLayerReconcileArgs, assetID: string): TMarkerClickAction {
	if (args.selectedAssetIDsRef.current.has(assetID)) {
		return 'blur-marker';
	}
	if (args.hasSelectionRef.current && !args.allSelectedHaveGPSRef.current) {
		return 'assign-location';
	}
	if (
		args.hasSelectionRef.current &&
		!args.allSelectedHaveGPSRef.current &&
		!args.selectedAssetIDsRef.current.has(assetID)
	) {
		return 'update-focus-marker';
	}
	if (args.isSpiderfiedRef.current || args.focusedOverviewIDRef.current === assetID) {
		return 'blur-marker';
		// return 'open-lightbox';
	}
	return 'focus-marker';
}

/**
 * Marks the clicked marker as focused and updates previous focused icon state.
 *
 * @param args - Shared marker args.
 * @param marker - Focused marker.
 * @param assetID - Asset identifier.
 * @param markerData - Marker payload.
 * @param isGreyscale - Current icon style.
 */
function focusMarker(
	args: TUseOverviewLayerReconcileArgs,
	marker: L.Marker,
	assetID: string,
	markerData: TMapMarker,
	isGreyscale: boolean
): void {
	if (args.focusedOverviewIDRef.current) {
		const previousMarker = args.overviewMarkersRef.current.get(args.focusedOverviewIDRef.current);
		if (previousMarker) {
			previousMarker.setIcon(overviewIcon(args.focusedOverviewIDRef.current, false, isGreyscale));
		}
	}
	args.focusedOverviewIDRef.current = assetID;
	args.focusedOverviewCoordsRef.current = {lat: markerData.latitude, lng: markerData.longitude};
	marker.setIcon(overviewIcon(assetID, true, isGreyscale));
}

/**
 * Syncs marker coordinates when server payload has changed.
 *
 * @param args - Shared marker args.
 * @param existingMarker - Marker currently on the map.
 * @param assetID - Asset identifier.
 * @param markerData - Latest marker payload.
 * @returns `true` when marker position changed.
 */
function syncMarkerPosition(
	args: TUseOverviewLayerReconcileArgs,
	existingMarker: L.Marker,
	assetID: string,
	renderedMarkerData: TMarkerRenderData
): boolean {
	const currentLatLng = existingMarker.getLatLng();
	if (currentLatLng.lat === renderedMarkerData.latitude && currentLatLng.lng === renderedMarkerData.longitude) {
		return false;
	}
	existingMarker.setLatLng([renderedMarkerData.latitude, renderedMarkerData.longitude]);
	if (args.focusedOverviewIDRef.current === assetID) {
		args.focusedOverviewCoordsRef.current = {lat: renderedMarkerData.latitude, lng: renderedMarkerData.longitude};
	}
	return true;
}

/**
 * Syncs marker visibility for selected/unselected assets.
 *
 * @param args - Shared marker args.
 * @param existingMarker - Marker currently on the map.
 * @param assetID - Asset identifier.
 * @param isMarkerVisible - Desired visibility for marker.
 * @returns `true` when layer membership changed.
 */
function syncMarkerVisibility(
	args: TUseOverviewLayerReconcileArgs,
	existingMarker: L.Marker,
	assetID: string,
	isMarkerVisible: boolean
): boolean {
	const isVisible = args.visibleMarkerIDsRef.current.has(assetID);
	if (isMarkerVisible && !isVisible) {
		args.overviewLayerRef.current?.addLayer(existingMarker);
		args.visibleMarkerIDsRef.current.add(assetID);
		return true;
	}
	if (!isMarkerVisible && isVisible) {
		args.overviewLayerRef.current?.removeLayer(existingMarker);
		args.visibleMarkerIDsRef.current.delete(assetID);
		clearFocusedMarker(args, assetID);
		return true;
	}
	return false;
}

/**
 * Syncs marker icon greyscale state when it diverges from current mode.
 *
 * @param args - Shared marker args.
 * @param existingMarker - Marker currently on the map.
 * @param assetID - Asset identifier.
 * @param effectiveGreyscale - Whether marker should render in greyscale.
 * @returns `true` when the icon was updated.
 */
function syncMarkerIcon(
	args: TUseOverviewLayerReconcileArgs,
	existingMarker: L.Marker,
	assetID: string,
	effectiveGreyscale: boolean
): boolean {
	const typedMarker = existingMarker as L.Marker & {markerGreyscale?: boolean};
	if (typedMarker.markerGreyscale === effectiveGreyscale) {
		return false;
	}
	const isSelected = args.selectedAssetIDsRef.current.has(assetID);
	existingMarker.setIcon(overviewIcon(assetID, isSelected, effectiveGreyscale));
	typedMarker.markerGreyscale = effectiveGreyscale;
	return true;
}

function clearFocusedMarker(args: TUseOverviewLayerReconcileArgs, assetID: string): void {
	if (args.focusedOverviewIDRef.current !== assetID) {
		return;
	}
	args.focusedOverviewIDRef.current = null;
	args.focusedOverviewCoordsRef.current = null;
}

/**
 * Resolve marker coordinates for rendering and reconciliation from pending edits if present.
 *
 * @param args - Sync args containing pending location map.
 * @param assetID - Asset identifier.
 * @param markerData - Marker payload from backend.
 * @returns Coordinates to use while rendering marker.
 */
function resolveMarkerData(
	args: TUseOverviewLayerReconcileArgs,
	assetID: string,
	markerData: TMapMarker
): TMarkerRenderData {
	const pendingLocation = args.pendingLocationsByAssetIDRef.current[assetID];
	if (pendingLocation) {
		return {
			immichID: markerData.immichID,
			latitude: pendingLocation.latitude,
			longitude: pendingLocation.longitude
		};
	}
	const savedLocation = args.savedLocationsByAssetIDRef.current[assetID];
	if (!savedLocation) {
		return markerData;
	}
	return {
		immichID: markerData.immichID,
		latitude: savedLocation.latitude,
		longitude: savedLocation.longitude
	};
}

/**
 * Removes optimistic saved coordinates after the backend marker position matches.
 *
 * @param args - Sync args containing optimistic location refs and clear callback.
 * @param assetID - Asset identifier.
 * @param markerData - Marker payload from backend.
 */
function clearOptimisticSavedLocation(
	args: TUseOverviewLayerReconcileArgs,
	assetID: string,
	markerData: TMapMarker
): void {
	if (args.pendingLocationsByAssetIDRef.current[assetID]) {
		return;
	}
	const savedLocation = args.savedLocationsByAssetIDRef.current[assetID];
	if (!savedLocation) {
		return;
	}
	if (savedLocation.latitude !== markerData.latitude) {
		return;
	}
	if (savedLocation.longitude !== markerData.longitude) {
		return;
	}
	args.clearSavedLocationsRef.current([assetID]);
}

/**
 * Builds a map from marker id to marker payload for fast reconciliation.
 *
 * @param mapMarkers - Incoming marker list.
 * @returns Map keyed by immichID.
 */
function buildNextMarkerDataByID(mapMarkers: TMapMarker[]): Map<string, TMapMarker> {
	return new Map(mapMarkers.map(markerData => [markerData.immichID, markerData]));
}
