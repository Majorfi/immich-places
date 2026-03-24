export type TMapMarker = {
	immichID: string;
	latitude: number;
	longitude: number;
};

export type TGPSFilter = 'no-gps' | 'with-gps';

export type THiddenFilter = 'all' | 'hidden' | 'visible';

export type TGPXStatusFilter = 'all' | 'alreadySet' | 'new' | 'edited';

export type TPendingLocation = {
	latitude: number;
	longitude: number;
	source:
		| 'map-click'
		| 'search'
		| 'suggestion'
		| 'drag-drop'
		| 'marker-drag'
		| 'gpx-import'
		| 'go-to'
		| 'remove-location';
	sourceLabel?: string;
	isAlreadyApplied?: boolean;
	hasExistingLocation?: boolean;
	originalLatitude?: number;
	originalLongitude?: number;
};

export type TPendingLocationsByAssetID = Record<string, TPendingLocation>;

export type TSetLocationOptions = {
	latitude: number;
	longitude: number;
	source: TPendingLocation['source'];
	targetAssetIDs?: string[];
	shouldSkipPendingLocation?: boolean;
	sourceLabel?: string;
	isAlreadyApplied?: boolean;
	hasExistingLocation?: boolean;
	originalLatitude?: number;
	originalLongitude?: number;
};

export type TMapContextMenuCluster = {
	type: 'cluster';
	x: number;
	y: number;
	onZoom: () => void;
	onSpiderfy: () => void;
	canSpiderfy: boolean;
};

export type TMapContextMenuMarker = {
	type: 'marker';
	x: number;
	y: number;
	assetID: string;
	canResetPosition?: boolean;
	originalLatitude?: number;
	originalLongitude?: number;
};

export type TMapContextMenuState = TMapContextMenuCluster | TMapContextMenuMarker | null;
