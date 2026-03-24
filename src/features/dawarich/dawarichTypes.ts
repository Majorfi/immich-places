import {isFiniteNumber, isRecord, isString} from '@/utils/typeGuards';

export type TDawarichTrack = {
	ID: number;
	name: string;
	startedAt: string;
	finishedAt: string;
	distance: number;
	duration: number;
	syncedAt?: string;
};

export function isDawarichTrack(value: unknown): value is TDawarichTrack {
	if (!isRecord(value)) {
		return false;
	}
	return (
		isFiniteNumber(value.ID) &&
		isString(value.name) &&
		isString(value.startedAt) &&
		isString(value.finishedAt) &&
		isFiniteNumber(value.distance) &&
		isFiniteNumber(value.duration)
	);
}

export function isDawarichTrackArray(value: unknown): value is TDawarichTrack[] {
	return Array.isArray(value) && value.every(isDawarichTrack);
}

export type TDawarichSyncStatus = {
	syncing: boolean;
	lastSyncAt: string | null;
	lastSyncError: string | null;
	currentTrack: number | null;
	totalTracks: number | null;
};

export function isDawarichSyncStatus(value: unknown): value is TDawarichSyncStatus {
	if (!isRecord(value)) {
		return false;
	}
	return (
		typeof value.syncing === 'boolean' &&
		(value.lastSyncAt === null || isString(value.lastSyncAt)) &&
		(value.lastSyncError === null || isString(value.lastSyncError)) &&
		(value.currentTrack === null || isFiniteNumber(value.currentTrack)) &&
		(value.totalTracks === null || isFiniteNumber(value.totalTracks))
	);
}
