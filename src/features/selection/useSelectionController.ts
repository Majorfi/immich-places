'use client';

import {useCallback, useState} from 'react';

import {useLocationAssignment} from '@/features/selection/useLocationAssignment';

import type {TSelectionController} from '@/shared/types/context';
import type {TGPXStatusFilter} from '@/shared/types/map';

/**
 * Dependencies for building a selection controller instance.
 */
type TSelectionControllerArgs = {
	onAssetSavedAction: (assetID: string) => void;
	onBatchSavedAction: () => Promise<void>;
};

/**
 * Compose selection workflows and expose controller-ready state/actions.
 *
 * Bridges save callbacks into location assignment and tracks a map-marker refresh
 * version token after batch saves.
 *
 * @param args - Save callbacks from higher-level orchestration.
 * @returns Normalized selection controller object for application context.
 */
export function useSelectionController({
	onAssetSavedAction,
	onBatchSavedAction
}: TSelectionControllerArgs): TSelectionController {
	const [mapMarkersVersion, setMapMarkersVersion] = useState(0);
	const [gpxStatusFilter, setGPXStatusFilterAction] = useState<TGPXStatusFilter>('all');

	const handleBatchSaved = useCallback(async () => {
		await onBatchSavedAction();
		setMapMarkersVersion(v => v + 1);
	}, [onBatchSavedAction]);

	const {
		selectedAssets,
		pendingLocation,
		pendingLocationsByAssetID,
		savedLocationsByAssetID,
		isSaving,
		error: saveError,
		toggleAssetAction,
		shiftSelectAction,
		selectAllAction,
		clearSelectionAction,
		clearSavedLocationsAction,
		setLocationAction,
		clearLocationAction,
		saveAction,
		undoLocationAction,
		redoLocationAction,
		canUndoLocation,
		canRedoLocation,
		beginLocationBatch,
		endLocationBatch
	} = useLocationAssignment(onAssetSavedAction, handleBatchSaved);

	const bumpMapMarkers = useCallback(() => setMapMarkersVersion(v => v + 1), []);

	return {
		selectedAssets,
		pendingLocation,
		pendingLocationsByAssetID,
		savedLocationsByAssetID,
		isSaving,
		saveError,
		toggleAssetAction,
		shiftSelectAction,
		selectAllAction,
		clearSelectionAction,
		clearSavedLocationsAction,
		setLocationAction,
		clearLocationAction,
		saveAction,
		undoLocationAction,
		redoLocationAction,
		canUndoLocation,
		canRedoLocation,
		beginLocationBatch,
		endLocationBatch,
		mapMarkersVersion,
		bumpMapMarkers,
		gpxStatusFilter,
		setGPXStatusFilterAction
	};
}
