'use client';

import {useCallback, useEffect, useRef, useState} from 'react';

import {
	dawarichPreview,
	fetchDawarichSyncStatus,
	fetchDawarichTracks,
	saveDawarichSettings,
	triggerDawarichSync
} from '@/features/dawarich/dawarichApi';
import {getErrorMessage} from '@/utils/error';
import {
	RESYNC_BACKOFF_MULTIPLIER,
	RESYNC_INITIAL_POLL_DELAY_MS,
	RESYNC_MAX_POLL_DELAY_MS,
	RESYNC_MAX_POLL_DURATION_MS
} from '@/utils/resync';

import type {TDawarichSyncStatus, TDawarichTrack} from '@/features/dawarich/dawarichTypes';
import type {TGPXPreviewResponse} from '@/features/gpxImport/gpxImportTypes';

type TDawarichStep = 'setup' | 'syncing' | 'tracks' | 'previewing';

type TDawarichState = {
	step: TDawarichStep;
	isLoading: boolean;
	error: string | null;
	tracks: TDawarichTrack[];
	previews: TGPXPreviewResponse[];
	syncProgress: TDawarichSyncStatus | null;
};

const INITIAL_STATE: TDawarichState = {
	step: 'setup',
	isLoading: false,
	error: null,
	tracks: [],
	previews: [],
	syncProgress: null
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
	refreshSync: () => Promise<void>;
	reset: () => void;
};

export function useDawarich(hasCredentials: boolean): TUseDawarichReturn {
	const [state, setState] = useState<TDawarichState>(() => ({
		...INITIAL_STATE,
		step: resolveInitialStep(hasCredentials)
	}));

	const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const stopPolling = useCallback(() => {
		if (pollingRef.current !== null) {
			clearTimeout(pollingRef.current);
			pollingRef.current = null;
		}
	}, []);

	const pollSyncStatus = useCallback(
		(onComplete: () => void) => {
			stopPolling();
			let delay = RESYNC_INITIAL_POLL_DELAY_MS;
			const startedAt = Date.now();

			const poll = async (): Promise<void> => {
				if (Date.now() - startedAt > RESYNC_MAX_POLL_DURATION_MS) {
					setState(prev => ({
						...prev,
						step: 'tracks',
						isLoading: false,
						error: 'Sync polling timed out',
						syncProgress: null
					}));
					return;
				}

				try {
					const status = await fetchDawarichSyncStatus();
					setState(prev => ({...prev, syncProgress: status}));

					if (!status.syncing) {
						if (status.lastSyncError) {
							setState(prev => ({
								...prev,
								step: 'tracks',
								isLoading: false,
								error: `Sync failed: ${status.lastSyncError}`,
								syncProgress: null
							}));
						} else {
							onComplete();
						}
						return;
					}
				} catch {
					// ignore polling errors, retry
				}

				delay = Math.min(delay * RESYNC_BACKOFF_MULTIPLIER, RESYNC_MAX_POLL_DELAY_MS);
				pollingRef.current = setTimeout(() => void poll(), delay);
			};

			void poll();
		},
		[stopPolling] // eslint-disable-line react-hooks/exhaustive-deps
	);

	const loadTracksAfterSync = useCallback(async () => {
		try {
			const tracks = await fetchDawarichTracks();
			setState(prev => ({
				...prev,
				step: 'tracks',
				isLoading: false,
				error: null,
				tracks,
				syncProgress: null
			}));
		} catch (err) {
			setState(prev => ({
				...prev,
				step: 'tracks',
				isLoading: false,
				error: getErrorMessage(err, 'Failed to load tracks after sync'),
				syncProgress: null
			}));
		}
	}, []);

	useEffect(() => {
		if (hasCredentials && state.step === 'setup') {
			setState(prev => ({...prev, step: 'tracks'}));
		}
		if (!hasCredentials && state.step !== 'setup') {
			stopPolling();
			setState({...INITIAL_STATE, step: 'setup'});
		}
	}, [hasCredentials]); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		return stopPolling;
	}, [stopPolling]);

	const saveSettings = useCallback(
		async (apiKey: string): Promise<void> => {
			setState(prev => ({...prev, isLoading: true, error: null}));
			try {
				await saveDawarichSettings(apiKey);
				setState(prev => ({...prev, step: 'syncing'}));
				pollSyncStatus(() => void loadTracksAfterSync());
			} catch (err) {
				setState(prev => ({
					...prev,
					isLoading: false,
					error: getErrorMessage(err, 'Failed to save settings')
				}));
			}
		},
		[pollSyncStatus, loadTracksAfterSync]
	);

	const loadTracks = useCallback(async (): Promise<void> => {
		setState(prev => ({...prev, isLoading: true, error: null}));
		try {
			const status = await fetchDawarichSyncStatus();
			if (status.syncing) {
				setState(prev => ({...prev, step: 'syncing', syncProgress: status}));
				pollSyncStatus(() => void loadTracksAfterSync());
				return;
			}
			const tracks = await fetchDawarichTracks();
			setState(prev => {
				if (prev.step === 'previewing') {
					return {...prev, tracks};
				}
				return {...prev, isLoading: false, tracks};
			});
		} catch (err) {
			console.error('[useDawarich] loadTracks error:', err);
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
	}, [pollSyncStatus, loadTracksAfterSync]);

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

	const refreshSync = useCallback(async (): Promise<void> => {
		setState(prev => ({...prev, step: 'syncing', isLoading: true, error: null, syncProgress: null}));
		try {
			await triggerDawarichSync();
			pollSyncStatus(() => void loadTracksAfterSync());
		} catch (err) {
			setState(prev => ({
				...prev,
				step: 'tracks',
				isLoading: false,
				error: getErrorMessage(err, 'Failed to trigger sync')
			}));
		}
	}, [pollSyncStatus, loadTracksAfterSync]);

	const reset = useCallback(() => {
		stopPolling();
		setState({
			...INITIAL_STATE,
			step: resolveInitialStep(hasCredentials)
		});
	}, [hasCredentials, stopPolling]);

	return {
		...state,
		saveSettings,
		loadTracks,
		preview,
		refreshSync,
		reset
	};
}
