'use client';

import {useCallback, useRef} from 'react';

import {useAlbums} from '@/features/albums/useAlbums';
import {useInitialCatalogLoad} from '@/features/albums/useInitialCatalogLoad';
import {useAssets} from '@/features/photoGrid/useAssets';

import type {TCatalogContextValue} from '@/shared/types/context';
import type {TGPSFilter} from '@/shared/types/map';
import type {TViewMode} from '@/shared/types/view';

/**
 * Inputs used to derive catalog data loading behavior.
 */
type TUseCatalogDomainArgs = {
	gpsFilter: TGPSFilter;
	pageSize: number;
	viewMode: TViewMode;
	selectedAlbumID: string | null;
	isReady: boolean;
};

/**
 * Result of catalog domain orchestration.
 */
type TUseCatalogDomainResult = {
	albums: TCatalogContextValue['albums'];
	albumsError: TCatalogContextValue['albumsError'];
	isLoadingAlbums: TCatalogContextValue['isLoadingAlbums'];
	loadAlbumsAction: () => Promise<void>;
	assets: TCatalogContextValue['assets'];
	total: TCatalogContextValue['total'];
	currentPage: TCatalogContextValue['currentPage'];
	isLoadingAssets: TCatalogContextValue['isLoadingAssets'];
	assetsError: TCatalogContextValue['assetsError'];
	loadPageAction: (page: number) => Promise<void>;
	focusPageRef: {current: number | null};
	removeAsset: (assetID: string) => void;
	clearCatalog: () => void;
};

/**
 * Creates catalog slice state for album list and asset paging.
 *
 * Coordinates album filter behavior, page loading, and initial bootstrap loading
 * through shared album/assets hooks.
 *
 * @param args - GPS filter, page size, view mode, album selection, readiness flag.
 * @returns Album/asset loading state and actions.
 */
export function useCatalogDomain({
	gpsFilter,
	pageSize,
	viewMode,
	selectedAlbumID,
	isReady
}: TUseCatalogDomainArgs): TUseCatalogDomainResult {
	const albumFilter = viewMode === 'album' ? selectedAlbumID : null;
	const focusPageRef = useRef<number | null>(null);

	const {
		assets,
		total,
		currentPage,
		isLoading: isLoadingAssets,
		error: assetsError,
		removeAsset,
		loadPageAction,
		clear: clearAssets
	} = useAssets(gpsFilter, pageSize, albumFilter, focusPageRef);
	const {
		albums,
		isLoading: isLoadingAlbums,
		error: albumsError,
		load: loadAlbumsAction,
		clear: clearAlbums
	} = useAlbums(gpsFilter);

	const clearCatalog = useCallback(() => {
		clearAssets();
		clearAlbums();
	}, [clearAssets, clearAlbums]);

	useInitialCatalogLoad({
		isReady,
		loadPageAction,
		loadAlbumsAction
	});

	return {
		albums,
		isLoadingAlbums,
		albumsError,
		loadAlbumsAction,
		assets,
		total,
		currentPage,
		isLoadingAssets,
		assetsError,
		loadPageAction,
		focusPageRef,
		removeAsset,
		clearCatalog
	};
}
