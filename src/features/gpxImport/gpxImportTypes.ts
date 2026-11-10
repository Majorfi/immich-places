export type TGPXTrackPoint = {
	latitude: number;
	longitude: number;
};

type TGPXTrackSummary = {
	name: string;
	points: TGPXTrackPoint[];
	startTime: string;
	endTime: string;
	pointCount: number;
};

export type TGPXMatchResult = {
	assetID: string;
	fileName: string;
	type: string;
	latitude: number;
	longitude: number;
	elevation: number;
	timeGap: number;
	isAlreadyApplied: boolean;
	hasExistingLocation: boolean;
	existingLatitude?: number;
	existingLongitude?: number;
	trackName?: string;
};

export type TGPXPreviewResponse = {
	track: TGPXTrackSummary;
	matches: TGPXMatchResult[];
	detectedTimezone: string;
};
