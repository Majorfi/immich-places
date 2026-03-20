import {isFiniteNumber, isRecord, isString} from '@/utils/typeGuards';

export type TDawarichTrack = {
	ID: number;
	name: string;
	startedAt: string;
	finishedAt: string;
	distance: number;
	duration: number;
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
