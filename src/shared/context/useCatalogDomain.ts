'use client';

import {useCallback, useEffect, useRef} from 'react';

import {useAlbums} from '@/features/albums/useAlbums';
import {useInitialCatalogLoad} from '@/features/albums/useInitialCatalogLoad';
import {useFolders} from '@/features/folders/useFolders';
import {useAssets} from '@/features/photoGrid/useAssets';

import type {TCatalogContextValue} from '@/shared/types/context';
import type {TGPSFilter, THiddenFilter} from '@/shared/types/map';
import type {TViewMode} from '@/shared/types/view';

type TUseCatalogDomainArgs = {
	gpsFilter: TGPSFilter;
	hiddenFilter: THiddenFilter;
	pageSize: number;
	viewMode: TViewMode;
	selectedAlbumID: string | null;
	selectedFolderPath: string | null;
	selectedTagID: string | null;
	startDate: string | null;
	endDate: string | null;
	isReady: boolean;
};

type TUseCatalogDomainResult = {
	albums: TCatalogContextValue['albums'];
	albumsError: TCatalogContextValue['albumsError'];
	isLoadingAlbums: TCatalogContextValue['isLoadingAlbums'];
	loadAlbumsAction: () => Promise<void>;
	folderTree: TCatalogContextValue['folderTree'];
	isLoadingFolders: TCatalogContextValue['isLoadingFolders'];
	foldersError: TCatalogContextValue['foldersError'];
	loadFolderTreeAction: () => Promise<void>;
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

export function useCatalogDomain({
	gpsFilter,
	hiddenFilter,
	pageSize,
	viewMode,
	selectedAlbumID,
	selectedFolderPath,
	selectedTagID,
	startDate,
	endDate,
	isReady
}: TUseCatalogDomainArgs): TUseCatalogDomainResult {
	let albumFilter: string | null = null;
	if (viewMode === 'album') {
		albumFilter = selectedAlbumID;
	}
	let folderPathFilter: string | null = null;
	if (viewMode === 'folders') {
		folderPathFilter = selectedFolderPath;
	}
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
	} = useAssets(
		gpsFilter,
		hiddenFilter,
		pageSize,
		albumFilter,
		selectedTagID,
		startDate,
		endDate,
		folderPathFilter,
		focusPageRef
	);
	const {
		albums,
		isLoading: isLoadingAlbums,
		error: albumsError,
		load: loadAlbumsAction,
		clear: clearAlbums
	} = useAlbums(gpsFilter, startDate, endDate);
	const {
		folderTree,
		isLoading: isLoadingFolders,
		error: foldersError,
		load: loadFolderTreeAction,
		clear: clearFolders
	} = useFolders(gpsFilter, hiddenFilter, selectedTagID, startDate, endDate);

	useEffect(() => {
		if (isReady && viewMode === 'folders' && folderTree === null && !isLoadingFolders && foldersError === null) {
			void loadFolderTreeAction();
		}
	}, [isReady, viewMode, folderTree, isLoadingFolders, foldersError, loadFolderTreeAction]);

	const clearCatalog = useCallback(() => {
		clearAssets();
		clearAlbums();
		clearFolders();
	}, [clearAssets, clearAlbums, clearFolders]);

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
		folderTree,
		isLoadingFolders,
		foldersError,
		loadFolderTreeAction,
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
