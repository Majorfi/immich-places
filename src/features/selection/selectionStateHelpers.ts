import type {TAssetRow} from '@/shared/types/asset';
import type {TPendingLocation, TPendingLocationsByAssetID} from '@/shared/types/map';

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

export function createPendingLocation(
	latitude: number,
	longitude: number,
	source: TPendingLocation['source'],
	sourceLabel?: string,
	isAlreadyApplied?: boolean
): TPendingLocation {
	const location: TPendingLocation = {latitude, longitude, source};
	if (sourceLabel) {
		location.sourceLabel = sourceLabel;
	}
	if (isAlreadyApplied) {
		location.isAlreadyApplied = true;
	}
	return location;
}

export function deriveAlreadyAppliedIDs(pendingLocationsByAssetID: TPendingLocationsByAssetID): Set<string> {
	return new Set(
		Object.entries(pendingLocationsByAssetID)
			.filter(([, loc]) => loc.isAlreadyApplied === true)
			.map(([assetID]) => assetID)
	);
}
