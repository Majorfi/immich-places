import {MAP_LOCATION_SOURCE_REMOVE_LOCATION} from '@/utils/map';

import type {TAssetRow} from '@/shared/types/asset';
import type {
	TGPXStatusFilter,
	TPendingLocation,
	TPendingLocationsByAssetID,
	TSetLocationOptions
} from '@/shared/types/map';

export function resolveAnchorID(lastClickedID: string | null, nextSelected: TAssetRow[]): string | null {
	if (nextSelected.length === 0) {
		return null;
	}
	if (!lastClickedID) {
		return nextSelected[0].immichID;
	}

	const matchingAsset = nextSelected.find(asset => asset.immichID === lastClickedID);
	if (matchingAsset) {
		return matchingAsset.immichID;
	}
	return nextSelected[0].immichID;
}

export function buildTargetAssetIDs(targetAssetIDs: string[] | undefined, selectedAssetIDs: string[]): string[] {
	if (targetAssetIDs && targetAssetIDs.length > 0) {
		return Array.from(new Set(targetAssetIDs));
	}
	if (selectedAssetIDs.length === 0) {
		return [];
	}
	return selectedAssetIDs;
}

type TCreatePendingLocationOptions = {
	latitude: number;
	longitude: number;
	source: TPendingLocation['source'];
	sourceLabel?: string;
	isAlreadyApplied?: boolean;
	hasExistingLocation?: boolean;
	originalLatitude?: number;
	originalLongitude?: number;
};

export function createPendingLocation(options: TCreatePendingLocationOptions): TPendingLocation {
	const location: TPendingLocation = {
		latitude: options.latitude,
		longitude: options.longitude,
		source: options.source
	};
	if (options.sourceLabel) {
		location.sourceLabel = options.sourceLabel;
	}
	if (options.isAlreadyApplied) {
		location.isAlreadyApplied = true;
	}
	if (options.hasExistingLocation !== undefined) {
		location.hasExistingLocation = options.hasExistingLocation;
	}
	if (options.originalLatitude !== undefined && options.originalLongitude !== undefined) {
		location.originalLatitude = options.originalLatitude;
		location.originalLongitude = options.originalLongitude;
	}
	return location;
}

export function matchesGPXStatusFilter(
	filter: TGPXStatusFilter,
	isAlreadyApplied: boolean,
	hasExistingLocation: boolean
): boolean {
	switch (filter) {
		case 'all':
			return true;
		case 'alreadySet':
			return isAlreadyApplied;
		case 'new':
			return !isAlreadyApplied && !hasExistingLocation;
		case 'edited':
			return !isAlreadyApplied && hasExistingLocation;
	}
}

export function hasGPXPendingEntries(pendingLocationsByAssetID: TPendingLocationsByAssetID): boolean {
	return Object.values(pendingLocationsByAssetID).some(loc => loc.source === 'gpx-import');
}

export function buildNextPendingLocations(
	prev: TPendingLocationsByAssetID,
	nextAssetIDs: string[],
	nextPendingLocation: TPendingLocation,
	options: TSetLocationOptions
): TPendingLocationsByAssetID {
	const next = {...prev};
	for (const assetID of nextAssetIDs) {
		const existing = prev[assetID];
		if (existing?.source === 'gpx-import' && nextPendingLocation.source !== MAP_LOCATION_SOURCE_REMOVE_LOCATION) {
			const coordinatesChanged =
				existing.isAlreadyApplied &&
				(options.latitude !== existing.latitude || options.longitude !== existing.longitude);
			let isAlreadyApplied = options.isAlreadyApplied ?? existing.isAlreadyApplied;
			if (coordinatesChanged) {
				isAlreadyApplied = false;
			}
			next[assetID] = createPendingLocation({
				latitude: options.latitude,
				longitude: options.longitude,
				source: 'gpx-import',
				sourceLabel: existing.sourceLabel,
				isAlreadyApplied,
				hasExistingLocation: options.hasExistingLocation ?? existing.hasExistingLocation,
				originalLatitude: options.originalLatitude ?? existing.originalLatitude,
				originalLongitude: options.originalLongitude ?? existing.originalLongitude
			});
		} else {
			next[assetID] = nextPendingLocation;
		}
	}
	return next;
}

export function deriveAlreadyAppliedIDs(pendingLocationsByAssetID: TPendingLocationsByAssetID): Set<string> {
	return new Set(
		Object.entries(pendingLocationsByAssetID)
			.filter(([, loc]) => loc.isAlreadyApplied)
			.map(([assetID]) => assetID)
	);
}
