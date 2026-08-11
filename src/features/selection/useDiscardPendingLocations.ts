'use client';

import {useCallback} from 'react';

import {useSelection} from '@/shared/context/AppContext';

const DISCARD_PROMPT = 'You have unsaved location edits. Do you want to discard them and continue?';

/**
 * Guards navigation that leaves the current asset context.
 *
 * Any action that swaps the view mode, the album or the folder has to go through
 * this: without it, pending location edits survive into an unrelated set of assets
 * and the user is never told they were dropped.
 *
 * @returns A wrapper that prompts when edits are pending, clears them once accepted,
 *   then runs the action. Runs nothing when the user cancels.
 */
export function useDiscardPendingLocations(): (nextAction: () => void) => void {
	const {selectedAssets, pendingLocation, pendingLocationsByAssetID, clearSelectionAction} = useSelection();

	const hasPendingEdits =
		Object.keys(pendingLocationsByAssetID).length > 0 || (selectedAssets.length > 0 && pendingLocation !== null);

	return useCallback(
		(nextAction: () => void): void => {
			if (hasPendingEdits && !window.confirm(DISCARD_PROMPT)) {
				return;
			}
			clearSelectionAction();
			nextAction();
		},
		[hasPendingEdits, clearSelectionAction]
	);
}
