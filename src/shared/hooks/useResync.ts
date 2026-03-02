'use client';

import {useCallback, useEffect, useRef, useState} from 'react';

import {fetchSyncStatus, triggerFullSync, triggerSync} from '@/shared/services/backendApi';
import {isAbortError, waitForDelay} from '@/utils/abort';
import {
	RESYNC_BACKOFF_MULTIPLIER,
	RESYNC_INITIAL_POLL_DELAY_MS,
	RESYNC_MAX_POLL_DELAY_MS,
	RESYNC_MAX_POLL_DURATION_MS
} from '@/utils/resync';

const SYNC_VERSION_STORAGE_KEY = 'syncVersion';

async function pollUntilDone(controller: AbortController): Promise<void> {
	const startTime = Date.now();
	let delayMs = RESYNC_INITIAL_POLL_DELAY_MS;

	while (true) {
		await waitForDelay(delayMs, controller.signal);
		if (Date.now() - startTime > RESYNC_MAX_POLL_DURATION_MS) {
			break;
		}
		const status = await fetchSyncStatus({signal: controller.signal});
		if (!status.syncing) {
			break;
		}
		delayMs = Math.min(Math.round(delayMs * RESYNC_BACKOFF_MULTIPLIER), RESYNC_MAX_POLL_DELAY_MS);
	}
}

function getStoredSyncVersion(): number {
	try {
		const raw = localStorage.getItem(SYNC_VERSION_STORAGE_KEY);
		if (raw === null) {
			return 0;
		}
		const parsed = parseInt(raw, 10);
		if (Number.isFinite(parsed)) {
			return parsed;
		}
	} catch {
		// localStorage unavailable (SSR, privacy mode)
	}
	return 0;
}

function setStoredSyncVersion(version: number): void {
	try {
		localStorage.setItem(SYNC_VERSION_STORAGE_KEY, String(version));
	} catch {
		// localStorage unavailable
	}
}

type TUseResyncArgs = {
	isReady: boolean;
	syncVersion: number;
	retryBackendAction: () => Promise<void>;
	refreshData: () => Promise<void>;
	refreshAuthAction: () => Promise<void>;
};

type TUseResyncResult = {
	isSyncing: boolean;
	syncError: string | null;
	resyncAction: () => Promise<void>;
	fullResyncAction: () => Promise<void>;
};

export function useResync({
	isReady,
	syncVersion,
	retryBackendAction,
	refreshData,
	refreshAuthAction
}: TUseResyncArgs): TUseResyncResult {
	const [isSyncing, setIsSyncing] = useState(false);
	const [syncError, setSyncError] = useState<string | null>(null);
	const isSyncingRef = useRef(false);
	const abortRef = useRef<AbortController | null>(null);
	const initialSyncCheckDoneRef = useRef(false);

	const retryBackendActionRef = useRef(retryBackendAction);
	retryBackendActionRef.current = retryBackendAction;
	const refreshDataRef = useRef(refreshData);
	refreshDataRef.current = refreshData;
	const refreshAuthActionRef = useRef(refreshAuthAction);
	refreshAuthActionRef.current = refreshAuthAction;

	const reloadData = useCallback(async () => {
		await retryBackendActionRef.current();
		await refreshDataRef.current();
		await refreshAuthActionRef.current();
	}, []);

	const runSyncFlow = useCallback(
		async (
			controller: AbortController,
			shouldStartSync: boolean,
			triggerFn: (opts: {signal: AbortSignal}) => Promise<void> = triggerSync
		): Promise<void> => {
			if (shouldStartSync) {
				await triggerFn({signal: controller.signal});
			} else {
				const status = await fetchSyncStatus({signal: controller.signal});
				if (!status.syncing) {
					return;
				}
			}

			await pollUntilDone(controller);
			await reloadData();
		},
		[reloadData]
	);

	const executeSync = useCallback(
		async (
			shouldStartSync: boolean,
			triggerFn?: (opts: {signal: AbortSignal}) => Promise<void>
		): Promise<boolean> => {
			if (isSyncingRef.current) {
				return false;
			}
			isSyncingRef.current = true;
			setIsSyncing(true);
			setSyncError(null);
			abortRef.current?.abort();
			const controller = new AbortController();
			abortRef.current = controller;

			let didSucceed = false;
			try {
				await runSyncFlow(controller, shouldStartSync, triggerFn);
				didSucceed = true;
			} catch (error) {
				if (isAbortError(error)) {
					return false;
				}
				setSyncError(error instanceof Error ? error.message : 'Sync failed');
			} finally {
				if (abortRef.current === controller) {
					abortRef.current = null;
				}
				isSyncingRef.current = false;
				setIsSyncing(false);
			}
			return didSucceed;
		},
		[runSyncFlow]
	);

	const resyncAction = useCallback(async () => {
		await executeSync(true);
	}, [executeSync]);

	const fullResyncAction = useCallback(async () => {
		await executeSync(true, triggerFullSync);
	}, [executeSync]);

	useEffect(() => {
		return () => {
			abortRef.current?.abort();
		};
	}, []);

	useEffect(() => {
		if (!isReady || initialSyncCheckDoneRef.current || syncVersion === 0) {
			return;
		}
		initialSyncCheckDoneRef.current = true;

		const storedVersion = getStoredSyncVersion();
		if (syncVersion > storedVersion) {
			void executeSync(true).then(didSucceed => {
				if (didSucceed) {
					setStoredSyncVersion(syncVersion);
				}
			});
		} else {
			void executeSync(false);
		}
	}, [isReady, syncVersion, executeSync]);

	return {isSyncing, syncError, resyncAction, fullResyncAction};
}
