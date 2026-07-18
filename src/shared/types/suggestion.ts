export type TSuggestionCategoryKey = 'suggested' | 'album' | 'sameDay' | 'twoDay' | 'weekly' | 'frequent' | 'neighbor';

export type TLocationCluster = {
	latitude: number;
	longitude: number;
	label: string;
	count: number;
	secondsFromRef?: number;
};

export type TSuggestionsResponse = {
	sameDayClusters: TLocationCluster[];
	twoDayClusters: TLocationCluster[];
	weeklyClusters: TLocationCluster[];
	frequentLocations: TLocationCluster[];
	albumClusters: TLocationCluster[];
	neighborClusters: TLocationCluster[];
};

export type TRawSuggestionsResponse = {
	sameDayClusters: TLocationCluster[] | null;
	twoDayClusters: TLocationCluster[] | null;
	weeklyClusters: TLocationCluster[] | null;
	frequentLocations: TLocationCluster[] | null;
	albumClusters: TLocationCluster[] | null;
	neighborClusters: TLocationCluster[] | null;
};

export type TSuggestionCategory = {
	key: string;
	label: string;
	clusters: TLocationCluster[];
};
