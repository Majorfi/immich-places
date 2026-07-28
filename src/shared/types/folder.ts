export type TFolderNode = {
	name: string;
	path: string;
	assetCount: number;
	children: TFolderNode[];
};

export type TFolderTree = {
	children: TFolderNode[];
};
