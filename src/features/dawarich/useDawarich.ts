'use client';

import {useCallback, useEffect, useState} from 'react';

import {dawarichPreview, fetchDawarichTracks, saveDawarichSettings} from '@/features/dawarich/dawarichApi';
import {getErrorMessage} from '@/utils/error';

import type {TDawarichTrack} from '@/features/dawarich/dawarichTypes';
import type {TGPXPreviewResponse} from '@/features/gpxImport/gpxImportTypes';

type TDawarichStep = 'setup' | 'tracks' | 'previewing';

type TDawarichState = {
	step: TDawarichStep;
	isLoading: boolean;
	error: string | null;
	tracks: TDawarichTrack[];
	previews: TGPXPreviewResponse[];
};

const INITIAL_STATE: TDawarichState = {
	step: 'setup',
	isLoading: false,
	error: null,
	tracks: [],
	previews: []
};

function resolveInitialStep(hasCredentials: boolean): TDawarichStep {
	if (hasCredentials) {
		return 'tracks';
	}
	return 'setup';
}

export type TUseDawarichReturn = TDawarichState & {
	saveSettings: (apiKey: string) => Promise<void>;
	loadTracks: () => Promise<void>;
	preview: (trackIDs: number[], maxGapSeconds: number) => Promise<TGPXPreviewResponse[]>;
	reset: () => void;
};

export function useDawarich(hasCredentials: boolean): TUseDawarichReturn {
	const [state, setState] = useState<TDawarichState>(() => ({
		...INITIAL_STATE,
		step: resolveInitialStep(hasCredentials)
	}));

	useEffect(() => {
		if (hasCredentials && state.step === 'setup') {
			setState(prev => ({...prev, step: 'tracks'}));
		}
		if (!hasCredentials && state.step !== 'setup') {
			setState({...INITIAL_STATE, step: 'setup'});
		}
	}, [hasCredentials]); // eslint-disable-line react-hooks/exhaustive-deps

	const saveSettings = useCallback(async (apiKey: string): Promise<void> => {
		setState(prev => ({...prev, isLoading: true, error: null}));
		try {
			await saveDawarichSettings(apiKey);
			const tracks = await fetchDawarichTracks();
			setState({
				step: 'tracks',
				isLoading: false,
				error: null,
				tracks,
				previews: []
			});
		} catch (err) {
			setState(prev => ({
				...prev,
				isLoading: false,
				error: getErrorMessage(err, 'Failed to save settings')
			}));
		}
	}, []);

	const loadTracks = useCallback(async (): Promise<void> => {
		setState(prev => ({...prev, isLoading: true, error: null}));
		try {
			const tracks = await fetchDawarichTracks();
			setState(prev => {
				if (prev.step === 'previewing') {
					return {...prev, tracks};
				}
				return {...prev, isLoading: false, tracks};
			});
		} catch (err) {
			setState(prev => {
				if (prev.step === 'previewing') {
					return prev;
				}
				return {
					...prev,
					isLoading: false,
					error: getErrorMessage(err, 'Failed to load tracks')
				};
			});
		}
	}, []);

	const preview = useCallback(async (trackIDs: number[], maxGapSeconds: number): Promise<TGPXPreviewResponse[]> => {
		setState(prev => ({...prev, step: 'previewing', isLoading: true, error: null}));
		try {
			const results = await dawarichPreview(trackIDs, maxGapSeconds);
			setState(prev => ({...prev, previews: results, isLoading: false}));
			return results;
		} catch (err) {
			setState(prev => ({
				...prev,
				step: 'tracks',
				isLoading: false,
				error: getErrorMessage(err, 'Preview failed')
			}));
			return [];
		}
	}, []);

	const reset = useCallback(() => {
		setState({
			...INITIAL_STATE,
			step: resolveInitialStep(hasCredentials)
		});
	}, [hasCredentials]);

	return {
		...state,
		saveSettings,
		loadTracks,
		preview,
		reset
	};
}
