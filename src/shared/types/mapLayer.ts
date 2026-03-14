import type {TAssetRow} from '@/shared/types/asset';
import type {
	TGPSFilter,
	TMapContextMenuState,
	TMapMarker,
	TPendingLocation,
	TPendingLocationsByAssetID,
	TSetLocationOptions
} from '@/shared/types/map';
import type L from 'leaflet';
import type {RefObject} from 'react';

export type TUseOverviewLayerArgs = {
	mapInstanceRef: RefObject<L.Map | null>;
	gpsFilter: TGPSFilter;
	albumFilter: string | null;
	mapMarkers: TMapMarker[];
	selectedAssets: TAssetRow[];
	pendingLocation: TPendingLocation | null;
	pendingLocationsByAssetID: TPendingLocationsByAssetID;
	savedLocationsByAssetID: TPendingLocationsByAssetID;
	pendingLocationsByAssetIDRef: RefObject<TPendingLocationsByAssetID>;
	savedLocationsByAssetIDRef: RefObject<TPendingLocationsByAssetID>;
	clearSavedLocationsRef: RefObject<(assetIDs: string[]) => void>;
	toggleAssetRef: RefObject<(asset: TAssetRow, mode?: 'single' | 'additive') => void>;
	resolveAssetByIDRef: RefObject<(assetID: string) => TAssetRow | null>;
	setLocationRef: RefObject<(options: TSetLocationOptions) => void>;
	openLightboxRef: RefObject<(assetID: string) => void>;
	hasSelectionRef: RefObject<boolean>;
	allSelectedHaveGPSRef: RefObject<boolean>;
	focusedOverviewIDRef: RefObject<string | null>;
	focusedOverviewCoordsRef: RefObject<{lat: number; lng: number} | null>;
	overviewMarkersRef: RefObject<Map<string, L.Marker>>;
	overviewLayerRef: RefObject<L.MarkerClusterGroup | null>;
	isSpiderfiedRef: RefObject<boolean>;
	spiderCenterRef: RefObject<{lat: number; lng: number} | null>;
	selectedAssetIDsRef: RefObject<Set<string>>;
	groupMovePillRef: RefObject<L.Marker | null>;
	groupAnchorMarkerRef: RefObject<L.Marker | null>;
	pendingSelectionMarkerRef: RefObject<L.Marker | null>;
	openContextMenuRef: RefObject<(menu: TMapContextMenuState) => void>;
};

export type TUseOverviewLayerReconcileArgs = {
	visibleMarkerIDsRef: RefObject<Set<string>>;
	selectedIDs: Set<string>;
	markerDataByIDRef: RefObject<Map<string, TMapMarker>>;
	layerGreyscaleRef: RefObject<boolean | null>;
	pendingLocationsByAssetID: TPendingLocationsByAssetID;
	savedLocationsByAssetID: TPendingLocationsByAssetID;
	selectedAssetIDsRef: RefObject<Set<string>>;
} & TUseOverviewLayerArgs;
