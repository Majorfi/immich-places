'use client';

import {useCallback, useState} from 'react';

import {delayMs, saveAssetLocationsWithRetry} from '@/features/selection/locationSave';
import {useSelectionState} from '@/features/selection/useSelectionState';
import {getErrorMessage} from '@/utils/error';
import {LOCATION_SAVE_REQUEST_DELAY_MS} from '@/utils/locationAssignment';

import type {TSelectMode} from '@/features/selection/useSelectionState';
import type {TAssetRow} from '@/shared/types/asset';
import type {TSelectionSaveResult} from '@/shared/types/context';
import type {TPendingLocation, TPendingLocationsByAssetID, TSetLocationOptions} from '@/shared/types/map';

/** Return contract for location-assignment behavior exposed to UI controllers. */
type TUseLocationAssignmentReturn = {
	selectedAssets: TAssetRow[];
	pendingLocation: TPendingLocation | null;
	pendingLocationsByAssetID: TPendingLocationsByAssetID;
	savedLocationsByAssetID: TPendingLocationsByAssetID;
	isSaving: boolean;
	error: string | null;
	toggleAssetAction: (asset: TAssetRow, mode?: TSelectMode) => void;
	shiftSelectAction: (asset: TAssetRow, allAssets: TAssetRow[]) => void;
	selectAllAction: (assets: TAssetRow[]) => void;
	clearSelectionAction: () => void;
	clearSavedLocationsAction: (assetIDs: string[]) => void;
	setLocationAction: (options: TSetLocationOptions) => void;
	clearLocationAction: (clearPendingOnly?: boolean) => void;
	saveAction: () => Promise<TSelectionSaveResult>;
	undoLocationAction: () => void;
	redoLocationAction: () => void;
	canUndoLocation: boolean;
	canRedoLocation: boolean;
	beginLocationBatch: () => void;
	endLocationBatch: () => void;
};

/**
 * Composes selection state and persistence flow for assigning locations.
 *
 * Exposes selection helpers plus a `saveAction` that writes location data
 * for selected assets and reports partial/full/no-op outcomes.
 *
 * @param onSavedAction - Called once per successfully persisted asset ID.
 * @param onBatchSavedAction - Optional callback after a full batch save.
 * @returns Selection state, save status, and action handlers.
 */
export function useLocationAssignment(
	onSavedAction: (assetID: string) => void,
	onBatchSavedAction?: () => Promise<void>
): TUseLocationAssignmentReturn {
	const [isSaving, setIsSaving] = useState(false);
	const {
		selectedAssets,
		pendingLocation,
		pendingLocationsByAssetID,
		savedLocationsByAssetID,
		error,
		setError,
		setSelectedAssets,
		setPendingLocation,
		toggleAsset,
		shiftSelect,
		selectAll,
		clearSelection,
		setLocation,
		clearLocation,
		setPendingLocationsByAssetID,
		setSavedLocationsByAssetID,
		undoLocation,
		redoLocation,
		canUndoLocation,
		canRedoLocation,
		beginLocationBatch,
		endLocationBatch
	} = useSelectionState();

	const clearSavedLocations = useCallback(
		(assetIDs: string[]) => {
			if (assetIDs.length === 0) {
				return;
			}
			const assetIDSet = new Set(assetIDs);
			setSavedLocationsByAssetID(prev => {
				const next = {...prev};
				let hasChange = false;
				for (const assetID of Object.keys(next)) {
					if (!assetIDSet.has(assetID)) {
						continue;
					}
					delete next[assetID];
					hasChange = true;
				}
				if (!hasChange) {
					return prev;
				}
				return next;
			});
		},
		[setSavedLocationsByAssetID]
	);

	const clearSelectionAndPendingLocation = useCallback(() => {
		setSelectedAssets([]);
		setPendingLocation(null);
		setPendingLocationsByAssetID({});
	}, [setPendingLocation, setPendingLocationsByAssetID, setSelectedAssets]);

	const movePendingToSavedLocations = useCallback(
		(assetIDs: string[], fallbackLocation: TPendingLocation | null) => {
			if (assetIDs.length === 0) {
				return;
			}
			const assetIDSet = new Set(assetIDs);
			setSavedLocationsByAssetID(prev => {
				const next = {...prev};
				let hasSavedChange = false;
				for (const assetID of Object.keys(pendingLocationsByAssetID)) {
					if (!assetIDSet.has(assetID)) {
						continue;
					}
					next[assetID] = pendingLocationsByAssetID[assetID];
					hasSavedChange = true;
				}
				if (fallbackLocation) {
					for (const assetID of assetIDSet) {
						if (next[assetID]) {
							continue;
						}
						next[assetID] = fallbackLocation;
						hasSavedChange = true;
					}
				}
				if (!hasSavedChange) {
					return prev;
				}
				return next;
			});
			setPendingLocationsByAssetID(prev => {
				const next = {...prev};
				for (const assetID of Object.keys(next)) {
					if (assetIDSet.has(assetID)) {
						delete next[assetID];
					}
				}
				return next;
			});
		},
		[pendingLocationsByAssetID, setSavedLocationsByAssetID, setPendingLocationsByAssetID]
	);

	const pendingAssetIDs = useCallback(() => Object.keys(pendingLocationsByAssetID), [pendingLocationsByAssetID]);

	const keepFailedSelection = useCallback(
		(failedIDs: string[], totalCount: number, failedErrorsByID: Record<string, string>): void => {
			const firstFailedID = failedIDs[0];
			const firstFailedReason = firstFailedID ? failedErrorsByID[firstFailedID] : null;
			const details = firstFailedReason ? ` (${firstFailedReason})` : '';
			const failedIDSet = new Set(failedIDs);
			const nextSelection = selectedAssets.filter(asset => failedIDSet.has(asset.immichID));
			setSelectedAssets(nextSelection);
			setPendingLocationsByAssetID(prev => {
				const next = {...prev};
				for (const assetID of Object.keys(next)) {
					if (!failedIDSet.has(assetID)) {
						delete next[assetID];
					}
				}
				return next;
			});
			setError(`Failed to save ${failedIDs.length} of ${totalCount} photos${details}`);
		},
		[selectedAssets, setError, setPendingLocationsByAssetID, setSelectedAssets]
	);

	const notifyBatchSaved = useCallback(async (): Promise<void> => {
		if (!onBatchSavedAction) {
			return;
		}
		await onBatchSavedAction();
	}, [onBatchSavedAction]);

	const applySaveResults = useCallback(
		(failedIDs: string[], failedErrorsByID: Record<string, string>, totalCount: number): TSelectionSaveResult => {
			if (failedIDs.length > 0) {
				keepFailedSelection(failedIDs, totalCount, failedErrorsByID);
				const firstFailedReason = failedErrorsByID[failedIDs[0]];
				const details = firstFailedReason ? ` (${firstFailedReason})` : '';
				return {
					status: 'partial',
					failedIDs,
					failedCount: failedIDs.length,
					errorMessage: `Failed to save ${failedIDs.length} of ${totalCount} photos${details}`
				};
			}
			return {status: 'saved'};
		},
		[keepFailedSelection]
	);

	const createPartialResult = (
		failedCount: number,
		errorMessage: string,
		failedIDs: string[] = []
	): TSelectionSaveResult => {
		return {
			status: 'partial',
			failedCount,
			failedIDs,
			errorMessage
		};
	};

	const resolveSaveAssetIDs = useCallback((): string[] => {
		const pendingAssetIDsToSave = pendingAssetIDs();
		if (pendingAssetIDsToSave.length > 0) {
			return pendingAssetIDsToSave;
		}
		if (!pendingLocation) {
			return [];
		}
		return selectedAssets.map(asset => asset.immichID);
	}, [pendingAssetIDs, pendingLocation, selectedAssets]);

	const getSavePayloads = useCallback(() => {
		const payloads = new Map<string, {assetIDs: string[]; latitude: number; longitude: number}>();
		const targetAssetIDs = resolveSaveAssetIDs();
		for (const assetID of targetAssetIDs) {
			const targetPendingLocation = pendingLocationsByAssetID[assetID] ?? pendingLocation;
			if (!targetPendingLocation) {
				continue;
			}
			if (targetPendingLocation.isAlreadyApplied) {
				continue;
			}
			const key = `${targetPendingLocation.latitude},${targetPendingLocation.longitude}`;
			const existingPayload = payloads.get(key);
			if (existingPayload) {
				existingPayload.assetIDs.push(assetID);
				continue;
			}
			payloads.set(key, {
				assetIDs: [assetID],
				latitude: targetPendingLocation.latitude,
				longitude: targetPendingLocation.longitude
			});
		}
		const payloadList = Array.from(payloads.values());
		let totalCount = 0;
		for (const payload of payloadList) {
			totalCount += payload.assetIDs.length;
		}
		return {payloads: payloadList, totalCount};
	}, [pendingLocation, pendingLocationsByAssetID, resolveSaveAssetIDs]);

	/**
	 * Persist pending locations for all edited assets with retry and result normalization.
	 */
	const save = useCallback(async (): Promise<TSelectionSaveResult> => {
		const {payloads, totalCount} = getSavePayloads();
		if (totalCount === 0) {
			return {status: 'noop'};
		}
		setIsSaving(true);
		setError(null);

		try {
			const groupedResults: {
				savedIDs: string[];
				failedIDs: string[];
				failedErrorsByID: Record<string, string>;
			}[] = [];

			for (let index = 0; index < payloads.length; index += 1) {
				const {assetIDs, latitude, longitude} = payloads[index];
				const result = await saveAssetLocationsWithRetry({
					assetIDs,
					latitude,
					longitude
				});
				groupedResults.push(result);
				if (index < payloads.length - 1) {
					await delayMs(LOCATION_SAVE_REQUEST_DELAY_MS);
				}
			}

			const savedIDs: string[] = [];
			const failedIDs: string[] = [];
			const failedErrorsByID: Record<string, string> = {};

			for (const result of groupedResults) {
				savedIDs.push(...result.savedIDs);
				failedIDs.push(...result.failedIDs);
				for (const [assetID, message] of Object.entries(result.failedErrorsByID)) {
					failedErrorsByID[assetID] = message;
				}
			}

			for (const id of savedIDs) {
				onSavedAction(id);
			}

			if (failedIDs.length > 0) {
				movePendingToSavedLocations(savedIDs, pendingAssetIDs().length === 0 ? pendingLocation : null);
				return applySaveResults(failedIDs, failedErrorsByID, totalCount);
			}

			try {
				await notifyBatchSaved();
			} catch (error) {
				const message = getErrorMessage(error, 'Failed to refresh catalog after save');
				setError(message);
				return createPartialResult(totalCount, message);
			}
			const isUsingFallback = pendingAssetIDs().length === 0 && pendingLocation !== null;
			movePendingToSavedLocations(savedIDs, isUsingFallback ? pendingLocation : null);
			clearSelectionAndPendingLocation();

			return {status: 'saved'};
		} catch (error) {
			const message = getErrorMessage(error, 'Failed to save location');
			setError(message);
			return createPartialResult(totalCount, message);
		} finally {
			setIsSaving(false);
		}
	}, [
		applySaveResults,
		pendingAssetIDs,
		pendingLocation,
		getSavePayloads,
		notifyBatchSaved,
		onSavedAction,
		movePendingToSavedLocations,
		setError,
		clearSelectionAndPendingLocation
	]);

	return {
		selectedAssets,
		pendingLocation,
		pendingLocationsByAssetID,
		savedLocationsByAssetID,
		isSaving,
		error,
		toggleAssetAction: toggleAsset,
		shiftSelectAction: shiftSelect,
		selectAllAction: selectAll,
		clearSavedLocationsAction: clearSavedLocations,
		clearSelectionAction: clearSelection,
		setLocationAction: setLocation,
		clearLocationAction: clearLocation,
		saveAction: save,
		undoLocationAction: undoLocation,
		redoLocationAction: redoLocation,
		canUndoLocation,
		canRedoLocation,
		beginLocationBatch,
		endLocationBatch
	};
}
