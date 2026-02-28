export type TAuthUser = {
	ID: string;
	email: string;
	createdAt: string;
};

export type TMeResponse = {
	user: TAuthUser;
	hasImmichAPIKey: boolean;
	hasLibraries: boolean;
	mapMarkerCount: number;
};

export type TAuthErrorCode = 'notAuthenticated';
