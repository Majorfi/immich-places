import type {TAlbumRow} from '@/shared/types/album';
import type {TAssetRow} from '@/shared/types/asset';
import type {THealthResponse} from '@/shared/types/health';
import type {TGPSFilter, TPendingLocation, TPendingLocationsByAssetID} from '@/shared/types/map';
import type {TLocationCluster, TSuggestionCategory} from '@/shared/types/suggestion';
import type {TViewMode} from '@/shared/types/view';

export type TBackendContextValue = {
	isReady: boolean;
	health: THealthResponse | null;
	backendError: string | null;
	retryBackendAction: () => Promise<void>;
	isSyncing: boolean;
	syncError: string | null;
	resyncAction: () => Promise<void>;
	refreshDataAction: () => Promise<void>;
	clearCatalogAction: () => void;
};

export type TViewContextValue = {
	gpsFilter: TGPSFilter;
	setGPSFilterAction: (filter: TGPSFilter) => void;
	pageSize: number;
	setPageSizeAction: (size: number) => void;
	gridColumns: number;
	setGridColumnsAction: (cols: number) => void;
	visibleMarkerLimit: number;
	setVisibleMarkerLimitAction: (limit: number) => void;
	viewMode: TViewMode;
	setViewModeAction: (mode: TViewMode) => void;
	selectedAlbumID: string | null;
	selectAlbumAction: (albumID: string | null) => void;
};

export type TCatalogContextValue = {
	albums: TAlbumRow[];
	isLoadingAlbums: boolean;
	albumsError: string | null;
	loadAlbumsAction: () => Promise<void>;

	assets: TAssetRow[];
	total: number;
	currentPage: number;
	isLoadingAssets: boolean;
	assetsError: string | null;
	loadPageAction: (page: number) => Promise<void>;

	suggestions: TLocationCluster[];
	categories: TSuggestionCategory[];
	suggestionsError: string | null;

	selectedAlbum: TAlbumRow | null;
};

export type TSelectionContextValue = {
	selectedAssets: TAssetRow[];
	pendingLocation: TPendingLocation | null;
	pendingLocationsByAssetID: TPendingLocationsByAssetID;
	savedLocationsByAssetID: TPendingLocationsByAssetID;
	isSaving: boolean;
	saveError: string | null;
	toggleAssetAction: (asset: TAssetRow, mode?: 'single' | 'additive') => void;
	shiftSelectAction: (asset: TAssetRow, allAssets: TAssetRow[]) => void;
	selectAllAction: (assets: TAssetRow[]) => void;
	clearSelectionAction: () => void;
	clearSavedLocationsAction: (assetIDs: string[]) => void;
	setLocationAction: (
		latitude: number,
		longitude: number,
		source: TPendingLocation['source'],
		targetAssetIDs?: string[],
		skipPendingLocation?: boolean
	) => void;
	clearLocationAction: (clearPendingOnly?: boolean) => void;
	saveAction: () => Promise<TSelectionSaveResult>;
};

export type TSelectionSaveStatus = 'noop' | 'saved';
export type TSelectionSaveResult =
	| {
			status: TSelectionSaveStatus;
	  }
	| {
			status: 'partial';
			failedIDs: string[];
			failedCount: number;
			errorMessage: string;
	  };

export type TUIMapContextValue = {
	focusedAssetID: string | null;
	clearFocusedAssetAction: () => void;
	focusMapAssetAction: (assetID: string) => Promise<void>;

	lightboxAssetID: string | null;
	openLightboxAction: (assetID: string) => void;
	closeLightboxAction: () => void;

	visibleMarkerTotalCount: number | null;
	isVisibleMarkerTotalCountStale: boolean;
	setVisibleMarkerTotalCountAction: (totalCount: number | null) => void;
	markVisibleMarkerTotalCountStaleAction: () => void;

	mapMarkersVersion: number;
};

export type TMapSceneValue = {
	gpsFilter: TViewContextValue['gpsFilter'];
	viewMode: TViewContextValue['viewMode'];
	selectedAlbumID: string | null;
	assets: TAssetRow[];
	selectedAssets: TSelectionContextValue['selectedAssets'];
	pendingLocation: TSelectionContextValue['pendingLocation'];
	pendingLocationsByAssetID: TSelectionContextValue['pendingLocationsByAssetID'];
	savedLocationsByAssetID: TSelectionContextValue['savedLocationsByAssetID'];
	setLocationAction: TSelectionContextValue['setLocationAction'];
	toggleAssetAction: TSelectionContextValue['toggleAssetAction'];
	clearLocationAction: TSelectionContextValue['clearLocationAction'];
	clearSelectionAction: TSelectionContextValue['clearSelectionAction'];
	clearSavedLocationsAction: TSelectionContextValue['clearSavedLocationsAction'];
	openLightboxAction: TUIMapContextValue['openLightboxAction'];
	closeLightboxAction: TUIMapContextValue['closeLightboxAction'];
	mapMarkersVersion: TUIMapContextValue['mapMarkersVersion'];
};

export type TSelectionController = TSelectionContextValue & {
	mapMarkersVersion: number;
	bumpMapMarkers: () => void;
};

export type TUIMapController = Omit<TUIMapContextValue, 'mapMarkersVersion'>;
