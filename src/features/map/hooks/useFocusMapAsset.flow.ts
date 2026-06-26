import {fetchAssetPageInfo} from '@/shared/services/backendApi';

import type {TViewMode} from '@/shared/types/view';

type TResolveFocusTargetArgs = {
	assetID: string;
	pageSize: number;
	viewMode: TViewMode;
	selectedAlbumID: string | null;
	selectedTagID: string | null;
	signal: AbortSignal;
};

/**
 * Focus resolution result used by map focus flows.
 */
type TFocusTarget = {
	page: number;
	albumID: string | null;
	requiresAlbumSwitch: boolean;
};

/**
 * Resolves the page and album context needed to focus an asset in map/list modes.
 *
 * Uses asset page lookup to find the correct page and whether the active album must
 * be changed before focusing.
 *
 * @param args - Asset id, view mode and paging context.
 * @returns Computed focus target with album switch hint.
 */
export async function resolveFocusTarget({
	assetID,
	pageSize,
	viewMode,
	selectedAlbumID,
	selectedTagID,
	signal
}: TResolveFocusTargetArgs): Promise<TFocusTarget> {
	const isAlbumMode = viewMode === 'album';
	const hasActiveAlbum = isAlbumMode && selectedAlbumID !== null;
	const tagParam = selectedTagID ?? undefined;

	if (hasActiveAlbum && selectedAlbumID) {
		const info = await fetchAssetPageInfo(assetID, pageSize, selectedAlbumID, tagParam, {signal});
		return {page: info.page, albumID: selectedAlbumID, requiresAlbumSwitch: false};
	}

	const info = await fetchAssetPageInfo(assetID, pageSize, undefined, tagParam, {signal});
	if (isAlbumMode && info.albumID) {
		const albumInfo = await fetchAssetPageInfo(assetID, pageSize, info.albumID, tagParam, {signal});
		return {
			page: albumInfo.page,
			albumID: info.albumID,
			requiresAlbumSwitch: true
		};
	}

	return {page: info.page, albumID: info.albumID, requiresAlbumSwitch: false};
}
