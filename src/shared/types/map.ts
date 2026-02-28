export type TMapMarker = {
	immichID: string;
	latitude: number;
	longitude: number;
};

export type TGPSFilter = 'no-gps' | 'with-gps';

export type TPendingLocation = {
	latitude: number;
	longitude: number;
	source: 'map-click' | 'search' | 'suggestion' | 'drag-drop' | 'marker-drag';
};

export type TPendingLocationsByAssetID = Record<string, TPendingLocation>;
