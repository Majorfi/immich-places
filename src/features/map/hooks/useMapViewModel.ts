'use client';

import {useCallback, useMemo, useState} from 'react';

import {useMapMarkers} from '@/features/map/hooks/useMapMarkers';
import {useMapScene, useView} from '@/shared/context/AppContext';

import type {TViewportBounds} from '@/shared/types/api';
import type {TAssetRow} from '@/shared/types/asset';
import type {TMapSceneValue} from '@/shared/types/context';
import type {TMapMarker} from '@/shared/types/map';

export type TUseMapViewModelReturn = {
	gpsFilter: TMapSceneValue['gpsFilter'];
	viewMode: TMapSceneValue['viewMode'];
	albumFilter: string | null;
	setMapBoundsAction: (bounds: TViewportBounds | null) => void;
	mapMarkers: ReturnType<typeof useMapMarkers>['mapMarkers'];
	mapMarkersError: ReturnType<typeof useMapMarkers>['error'];
	selectedAssets: TAssetRow[];
	isAssetSelected: (assetID: string) => boolean;
	pendingLocation: TMapSceneValue['pendingLocation'];
	pendingLocationsByAssetID: TMapSceneValue['pendingLocationsByAssetID'];
	savedLocationsByAssetID: TMapSceneValue['savedLocationsByAssetID'];
	clearLocationAction: TMapSceneValue['clearLocationAction'];
	setLocationAction: TMapSceneValue['setLocationAction'];
	clearSavedLocationsAction: TMapSceneValue['clearSavedLocationsAction'];
	toggleAssetAction: TMapSceneValue['toggleAssetAction'];
	clearSelectionAction: TMapSceneValue['clearSelectionAction'];
	openLightboxAction: TMapSceneValue['openLightboxAction'];
	closeLightboxAction: TMapSceneValue['closeLightboxAction'];
	resolveAssetByID: (assetID: string) => TAssetRow | null;
};

export function useMapViewModel(): TUseMapViewModelReturn {
	const {visibleMarkerLimit} = useView();
	const {
		gpsFilter,
		viewMode,
		selectedAlbumID,
		assets,
		selectedAssets,
		pendingLocation,
		pendingLocationsByAssetID,
		savedLocationsByAssetID,
		clearLocationAction,
		clearSavedLocationsAction,
		setLocationAction,
		toggleAssetAction,
		clearSelectionAction,
		openLightboxAction,
		closeLightboxAction,
		mapMarkersVersion
	} = useMapScene();

	const albumFilter = viewMode === 'album' ? selectedAlbumID : null;
	const [mapBounds, setMapBounds] = useState<TViewportBounds | null>(null);
	const {mapMarkers, error: mapMarkersError} = useMapMarkers(
		albumFilter,
		mapMarkersVersion,
		mapBounds,
		visibleMarkerLimit
	);
	const gpxMarkers = useMemo<TMapMarker[]>(() => {
		const entries = Object.entries(pendingLocationsByAssetID);
		const hasGPXSource = entries.some(([, loc]) => loc.source === 'gpx-import');
		if (!hasGPXSource) {
			return [];
		}
		return entries
			.filter(([, loc]) => loc.source === 'gpx-import')
			.map(([assetID, location]) => ({
				immichID: assetID,
				latitude: location.latitude,
				longitude: location.longitude
			}));
	}, [pendingLocationsByAssetID]);

	const pendingLocationMarkers = useMemo<TMapMarker[]>(() => {
		const existingIDs = new Set(mapMarkers.map(m => m.immichID));
		const markers: TMapMarker[] = [];
		for (const [assetID, location] of Object.entries(pendingLocationsByAssetID)) {
			if (location.source === 'gpx-import' || existingIDs.has(assetID)) {
				continue;
			}
			markers.push({immichID: assetID, latitude: location.latitude, longitude: location.longitude});
		}
		return markers;
	}, [mapMarkers, pendingLocationsByAssetID]);

	const hasGPXPreview = gpxMarkers.length > 0;
	let effectiveAlbumFilter = albumFilter;
	let effectiveMapMarkers = hasGPXPreview ? gpxMarkers : mapMarkers;
	if (hasGPXPreview) {
		effectiveAlbumFilter = 'gpx-import';
	} else if (pendingLocationMarkers.length > 0) {
		effectiveMapMarkers = [...mapMarkers, ...pendingLocationMarkers];
	}

	const assetByID = useMemo(() => {
		const map = new Map<string, TAssetRow>();
		for (const asset of assets) {
			map.set(asset.immichID, asset);
		}
		for (const selectedAsset of selectedAssets) {
			if (!map.has(selectedAsset.immichID)) {
				map.set(selectedAsset.immichID, selectedAsset);
			}
		}
		return map;
	}, [assets, selectedAssets]);

	const selectedIDs = useMemo(() => new Set(selectedAssets.map(asset => asset.immichID)), [selectedAssets]);
	const isAssetSelected = useCallback(
		(assetID: string): boolean => {
			return selectedIDs.has(assetID);
		},
		[selectedIDs]
	);

	const resolveAssetByID = useCallback(
		(assetID: string): TAssetRow | null => {
			return assetByID.get(assetID) ?? null;
		},
		[assetByID]
	);

	return {
		gpsFilter,
		viewMode,
		albumFilter: effectiveAlbumFilter,
		setMapBoundsAction: setMapBounds,
		mapMarkers: effectiveMapMarkers,
		mapMarkersError,
		selectedAssets,
		isAssetSelected,
		pendingLocation,
		pendingLocationsByAssetID,
		savedLocationsByAssetID,
		clearLocationAction,
		clearSavedLocationsAction,
		setLocationAction,
		toggleAssetAction,
		clearSelectionAction,
		openLightboxAction,
		closeLightboxAction,
		resolveAssetByID
	};
}
