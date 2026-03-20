import {isMeResponse} from '@/features/auth/authApi';
import {isDawarichTrackArray} from '@/features/dawarich/dawarichTypes';
import {backendFetch, parseJSON, throwIfErrorResponse} from '@/shared/services/backendApi.fetch';
import {isGPXPreviewResponse} from '@/shared/services/backendApi.guards';
import {getBackendBaseURL} from '@/utils/backendUrls';

import type {TDawarichTrack} from '@/features/dawarich/dawarichTypes';
import type {TGPXPreviewResponse} from '@/features/gpxImport/gpxImportTypes';
import type {TRequestOptions} from '@/shared/types/api';
import type {TMeResponse} from '@/shared/types/auth';

const BASE = getBackendBaseURL();

export async function saveDawarichSettings(apiKey: string, opts: TRequestOptions = {}): Promise<TMeResponse> {
	const response = await backendFetch(
		`${BASE}/dawarich/settings`,
		{
			method: 'PUT',
			headers: {'Content-Type': 'application/json'}, // eslint-disable-line @typescript-eslint/naming-convention
			body: JSON.stringify({apiKey})
		},
		opts
	);
	await throwIfErrorResponse(response, 'Failed to save Dawarich settings');
	return parseJSON(response, isMeResponse, 'Invalid Dawarich settings response');
}

export async function deleteDawarichSettings(opts: TRequestOptions = {}): Promise<TMeResponse> {
	const response = await backendFetch(`${BASE}/dawarich/settings`, {method: 'DELETE'}, opts);
	await throwIfErrorResponse(response, 'Failed to delete Dawarich settings');
	return parseJSON(response, isMeResponse, 'Invalid Dawarich delete response');
}

export async function fetchDawarichTracks(opts: TRequestOptions = {}): Promise<TDawarichTrack[]> {
	const response = await backendFetch(`${BASE}/dawarich/tracks`, {}, opts);
	await throwIfErrorResponse(response, 'Failed to fetch Dawarich tracks');
	return parseJSON(response, isDawarichTrackArray, 'Invalid Dawarich tracks response payload');
}

export async function dawarichPreview(
	trackIDs: number[],
	maxGapSeconds: number,
	opts: TRequestOptions = {}
): Promise<TGPXPreviewResponse[]> {
	const response = await backendFetch(
		`${BASE}/dawarich/preview`,
		{
			method: 'POST',
			headers: {'Content-Type': 'application/json'}, // eslint-disable-line @typescript-eslint/naming-convention
			body: JSON.stringify({trackIDs, maxGapSeconds})
		},
		{...opts, timeoutMs: 120_000}
	);
	await throwIfErrorResponse(response, 'Dawarich preview failed');
	return parseJSON(
		response,
		(value): value is TGPXPreviewResponse[] => Array.isArray(value) && value.every(isGPXPreviewResponse),
		'Invalid Dawarich preview response payload'
	);
}
