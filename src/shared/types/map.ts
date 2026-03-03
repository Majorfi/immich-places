export type TMapMarker = {
	immichID: string;
	latitude: number;
	longitude: number;
};

export type TGPSFilter = 'no-gps' | 'with-gps';

export type THiddenFilter = 'all' | 'hidden' | 'visible';

export type TPendingLocation = {
	latitude: number;
	longitude: number;
	source: 'map-click' | 'search' | 'suggestion' | 'drag-drop' | 'marker-drag' | 'gpx-import';
	sourceLabel?: string;
	isAlreadyApplied?: boolean;
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
};
