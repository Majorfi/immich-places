'use client';

import {useRef} from 'react';

import type {TAssetRow} from '@/shared/types/asset';
import type {TGPSFilter, TPendingLocationsByAssetID, TSetLocationOptions} from '@/shared/types/map';
import type L from 'leaflet';
import type {RefObject} from 'react';

type TUseMapViewRefsArgs = {
	gpsFilter: TGPSFilter;
	selectedAssets: TAssetRow[];
	openLightboxAction: (assetID: string) => void;
	toggleAssetAction: (asset: TAssetRow, mode?: 'single' | 'additive') => void;
	resolveAssetByID: (assetID: string) => TAssetRow | null;
	clearSavedLocationsAction: (assetIDs: string[]) => void;
	pendingLocationsByAssetID: TPendingLocationsByAssetID;
	savedLocationsByAssetID: TPendingLocationsByAssetID;
	setLocationAction: (options: TSetLocationOptions) => void;
};

type TUseMapViewRefsResult = {
	mapInstanceRef: RefObject<L.Map | null>;
	containerRef: RefObject<HTMLDivElement | null>;
	markerRef: RefObject<L.Marker | null>;
	overviewLayerRef: RefObject<L.MarkerClusterGroup | null>;
	fittedBoundsKeyRef: RefObject<string | null>;
	focusedOverviewIDRef: RefObject<string | null>;
	focusedOverviewCoordsRef: RefObject<{lat: number; lng: number} | null>;
	overviewMarkersRef: RefObject<Map<string, L.Marker>>;
	isSpiderfiedRef: RefObject<boolean>;
	spiderCenterRef: RefObject<{lat: number; lng: number} | null>;
	groupMovePillRef: RefObject<L.Marker | null>;
	groupAnchorMarkerRef: RefObject<L.Marker | null>;
	selectedAssetIDsRef: RefObject<Set<string>>;
	boundsDebounceRef: RefObject<ReturnType<typeof setTimeout> | null>;
	boundsKeyRef: RefObject<string>;
	programmaticMoveRef: RefObject<boolean>;
	openLightboxRef: RefObject<(assetID: string) => void>;
	toggleAssetRef: RefObject<(asset: TAssetRow, mode?: 'single' | 'additive') => void>;
	resolveAssetByIDRef: RefObject<(assetID: string) => TAssetRow | null>;
	setLocationRef: RefObject<(options: TSetLocationOptions) => void>;
	gpsFilterRef: RefObject<TGPSFilter>;
	hasSelectionRef: RefObject<boolean>;
	allSelectedHaveGPSRef: RefObject<boolean>;
	pendingLocationsByAssetIDRef: RefObject<TPendingLocationsByAssetID>;
	savedLocationsByAssetIDRef: RefObject<TPendingLocationsByAssetID>;
	clearSavedLocationsRef: RefObject<(assetIDs: string[]) => void>;
};

function useLatestRef<T>(value: T): RefObject<T> {
	const ref = useRef(value);
	ref.current = value;
	return ref;
}

export function useMapViewRefs({
	gpsFilter,
	selectedAssets,
	openLightboxAction,
	toggleAssetAction,
	resolveAssetByID,
	clearSavedLocationsAction,
	pendingLocationsByAssetID,
	savedLocationsByAssetID,
	setLocationAction
}: TUseMapViewRefsArgs): TUseMapViewRefsResult {
	const mapInstanceRef = useRef<L.Map | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const markerRef = useRef<L.Marker | null>(null);
	const overviewLayerRef = useRef<L.MarkerClusterGroup | null>(null);
	const fittedBoundsKeyRef = useRef<string | null>(null);
	const focusedOverviewIDRef = useRef<string | null>(null);
	const focusedOverviewCoordsRef = useRef<{lat: number; lng: number} | null>(null);
	const overviewMarkersRef = useRef<Map<string, L.Marker>>(new Map());
	const isSpiderfiedRef = useRef(false);
	const spiderCenterRef = useRef<{lat: number; lng: number} | null>(null);
	const groupMovePillRef = useRef<L.Marker | null>(null);
	const groupAnchorMarkerRef = useRef<L.Marker | null>(null);
	const boundsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const boundsKeyRef = useRef<string>('');
	const programmaticMoveRef = useRef(false);
	const selectedAssetIDsRef = useLatestRef(new Set(selectedAssets.map(asset => asset.immichID)));

	const openLightboxRef = useLatestRef(openLightboxAction);
	const toggleAssetRef = useLatestRef(toggleAssetAction);
	const resolveAssetByIDRef = useLatestRef(resolveAssetByID);
	const setLocationRef = useLatestRef(setLocationAction);
	const gpsFilterRef = useLatestRef(gpsFilter);
	const hasSelectionRef = useLatestRef(selectedAssets.length > 0);
	const allSelectedHaveGPSRef = useLatestRef(
		selectedAssets.length > 0 &&
			selectedAssets.every(
				asset =>
					asset.latitude !== null &&
					asset.longitude !== null &&
					pendingLocationsByAssetID[asset.immichID]?.source !== 'gpx-import'
			)
	);
	const pendingLocationsByAssetIDRef = useLatestRef(pendingLocationsByAssetID);
	const savedLocationsByAssetIDRef = useLatestRef(savedLocationsByAssetID);
	const clearSavedLocationsRef = useLatestRef(clearSavedLocationsAction);

	return {
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
	};
}
