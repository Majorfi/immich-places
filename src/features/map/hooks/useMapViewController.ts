'use client';

import {useCallback, useRef, useState} from 'react';

import {GEOLOCATION_PERMISSION_ERROR, GEOLOCATION_UNAVAILABLE_ERROR} from '@/features/map/constants';
import {useMapDropHandlers} from '@/features/map/hooks/useMapDropHandlers';
import {useMapBootstrap} from '@/features/map/hooks/useMapViewBootstrap';
import {useMapClickHandler} from '@/features/map/hooks/useMapViewClickHandler';
import {useMapViewRefs} from '@/features/map/hooks/useMapViewRefs';
import {usePendingSelectionMarker} from '@/features/map/hooks/usePendingSelectionMarker';
import {useOverviewLayer} from '@/features/map/overview/useOverviewLayer';
import {MAP_LOCATE_ME_ZOOM, MAP_LOCATION_SOURCE_DRAG_DROP} from '@/utils/map';

import {useMapAutoFit} from './useMapViewAutoFit';

import type {TUseMapViewModelReturn} from '@/features/map/hooks/useMapViewModel';
import type {TAssetRow} from '@/shared/types/asset';
import type {DragEvent, RefObject} from 'react';

type TUseMapViewControllerArgs = {
	mapModel: Pick<
		TUseMapViewModelReturn,
		| 'gpsFilter'
		| 'viewMode'
		| 'albumFilter'
		| 'setMapBoundsAction'
		| 'mapMarkers'
		| 'selectedAssets'
		| 'isAssetSelected'
		| 'pendingLocation'
		| 'pendingLocationsByAssetID'
		| 'savedLocationsByAssetID'
		| 'clearSavedLocationsAction'
		| 'clearLocationAction'
		| 'setLocationAction'
		| 'toggleAssetAction'
		| 'clearSelectionAction'
		| 'openLightboxAction'
		| 'closeLightboxAction'
		| 'resolveAssetByID'
	>;
};

type TUseMapViewControllerResult = {
	containerRef: RefObject<HTMLDivElement | null>;
	mapInteractionError: string | null;
	handleLocateMe: () => void;
	handleZoomIn: () => void;
	handleZoomOut: () => void;
	handleDragOver: (event: DragEvent<HTMLDivElement>) => void;
	handleDrop: (event: DragEvent<HTMLDivElement>) => void;
};

export function useMapViewController({
	mapModel: {
		gpsFilter,
		viewMode,
		albumFilter,
		setMapBoundsAction,
		mapMarkers,
		selectedAssets,
		isAssetSelected,
		pendingLocation,
		pendingLocationsByAssetID,
		savedLocationsByAssetID,
		clearSavedLocationsAction,
		clearLocationAction,
		setLocationAction,
		toggleAssetAction,
		clearSelectionAction,
		openLightboxAction,
		closeLightboxAction,
		resolveAssetByID
	}
}: TUseMapViewControllerArgs): TUseMapViewControllerResult {
	const [mapInteractionError, setMapInteractionError] = useState<string | null>(null);

	const {
		mapInstanceRef,
		containerRef,
		markerRef,
		overviewLayerRef,
		fittedBoundsKeyRef,
		focusedOverviewIDRef,
		focusedOverviewCoordsRef,
		overviewMarkersRef,
		isSpiderfiedRef,
		spiderCenterRef,
		groupMovePillRef,
		groupAnchorMarkerRef,
		boundsDebounceRef,
		boundsKeyRef,
		programmaticMoveRef,
		selectedAssetIDsRef,
		openLightboxRef,
		toggleAssetRef,
		resolveAssetByIDRef,
		setLocationRef,
		gpsFilterRef,
		hasSelectionRef,
		allSelectedHaveGPSRef,
		pendingLocationsByAssetIDRef,
		savedLocationsByAssetIDRef,
		clearSavedLocationsRef
	} = useMapViewRefs({
		gpsFilter,
		selectedAssets,
		openLightboxAction,
		toggleAssetAction,
		resolveAssetByID,
		clearSavedLocationsAction,
		pendingLocationsByAssetID,
		savedLocationsByAssetID,
		setLocationAction
	});

	const handleLocateMe = useCallback(() => {
		if (!mapInstanceRef.current) {
			return;
		}
		if (!navigator.geolocation) {
			setMapInteractionError(GEOLOCATION_UNAVAILABLE_ERROR);
			return;
		}
		navigator.geolocation.getCurrentPosition(
			position => {
				mapInstanceRef.current?.setView(
					[position.coords.latitude, position.coords.longitude],
					MAP_LOCATE_ME_ZOOM
				);
				setMapInteractionError(null);
			},
			() => {
				setMapInteractionError(GEOLOCATION_PERMISSION_ERROR);
			}
		);
	}, [mapInstanceRef]);

	const handleZoomIn = useCallback(() => mapInstanceRef.current?.zoomIn(), [mapInstanceRef]);
	const handleZoomOut = useCallback(() => mapInstanceRef.current?.zoomOut(), [mapInstanceRef]);

	useMapBootstrap({
		containerRef,
		mapInstanceRef,
		boundsDebounceRef,
		boundsKeyRef,
		programmaticMoveRef,
		setMapBoundsAction,
		clearLocationAction
	});

	useMapClickHandler({
		mapInstanceRef,
		focusedOverviewIDRef,
		overviewMarkersRef,
		overviewLayerRef,
		focusedOverviewCoordsRef,
		isSpiderfiedRef,
		groupMovePillRef,
		groupAnchorMarkerRef,
		gpsFilterRef,
		allSelectedHaveGPSRef,
		clearSelectionAction,
		closeLightboxAction,
		setLocationRef
	});

	usePendingSelectionMarker({
		mapInstanceRef,
		markerRef,
		programmaticMoveRef,
		pendingLocation,
		selectedAssets,
		setLocationAction,
		clearLocationAction
	});

	const prevFitAlbumRef = useRef(albumFilter);
	useMapAutoFit({
		mapInstanceRef,
		programmaticMoveRef,
		gpsFilter,
		viewMode,
		albumFilter,
		mapMarkers,
		fittedBoundsKeyRef,
		prevFitAlbumRef
	});

	useOverviewLayer({
		mapInstanceRef,
		gpsFilter,
		albumFilter,
		mapMarkers,
		selectedAssets,
		pendingSelectionMarkerRef: markerRef,
		pendingLocation,
		pendingLocationsByAssetID,
		savedLocationsByAssetID,
		pendingLocationsByAssetIDRef,
		savedLocationsByAssetIDRef,
		toggleAssetRef,
		setLocationRef,
		clearSavedLocationsRef,
		openLightboxRef,
		hasSelectionRef,
		allSelectedHaveGPSRef,
		focusedOverviewIDRef,
		focusedOverviewCoordsRef,
		overviewMarkersRef,
		overviewLayerRef,
		isSpiderfiedRef,
		spiderCenterRef,
		resolveAssetByIDRef,
		selectedAssetIDsRef,
		groupMovePillRef,
		groupAnchorMarkerRef
	});

	const handleDropToMap = useCallback(
		(droppedAsset: TAssetRow, position: {latitude: number; longitude: number}) => {
			const isDroppedAssetSelected = isAssetSelected(droppedAsset.immichID);
			let targetAssetIDs = [droppedAsset.immichID];
			if (isDroppedAssetSelected) {
				targetAssetIDs = selectedAssets.map(asset => asset.immichID);
			}
			setLocationAction({
				latitude: position.latitude,
				longitude: position.longitude,
				source: MAP_LOCATION_SOURCE_DRAG_DROP,
				targetAssetIDs
			});
		},
		[isAssetSelected, selectedAssets, setLocationAction]
	);

	const {handleDragOver, handleDrop: handleMapDrop} = useMapDropHandlers({
		mapInstanceRef,
		containerRef,
		resolveAssetByID,
		onDropAction: handleDropToMap
	});

	return {
		containerRef,
		mapInteractionError,
		handleLocateMe,
		handleZoomIn,
		handleZoomOut,
		handleDragOver,
		handleDrop: handleMapDrop
	};
}
