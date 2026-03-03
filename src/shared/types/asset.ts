export type TAssetRow = {
	immichID: string;
	type: string;
	originalFileName: string;
	fileCreatedAt: string;
	latitude: number | null;
	longitude: number | null;
	city: string | null;
	state: string | null;
	country: string | null;
	dateTimeOriginal: string | null;
	syncedAt: string;
	stackID?: string | null;
	stackPrimaryAssetID?: string | null;
	stackAssetCount?: number | null;
	isHidden: boolean;
};

export type TPaginatedAssets = {
	items: TAssetRow[];
	total: number;
	page: number;
	pageSize: number;
	hasNextPage: boolean;
};

export type TAssetPageInfo = {
	page: number;
	albumID: string | null;
};
