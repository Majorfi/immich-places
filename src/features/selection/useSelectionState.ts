'use client';

import {useCallback, useRef, useState} from 'react';

import {
	buildNextPendingLocations,
	buildTargetAssetIDs,
	createPendingLocation,
	resolveAnchorID
} from '@/features/selection/selectionStateHelpers';
import {useLocationHistory} from '@/features/selection/useLocationHistory';

import type {TLocationSnapshot} from '@/features/selection/useLocationHistory';
import type {TAssetRow} from '@/shared/types/asset';
import type {TPendingLocation, TPendingLocationsByAssetID, TSetLocationOptions} from '@/shared/types/map';
import type {Dispatch, SetStateAction} from 'react';

/** Selection interaction mode supported by asset selection helpers. */
export type TSelectMode = 'single' | 'additive';

/** Selection state hook return contract used across controller and UI features. */
type TUseSelectionStateReturn = {
	selectedAssets: TAssetRow[];
	pendingLocation: TPendingLocation | null;
	pendingLocationsByAssetID: TPendingLocationsByAssetID;
	savedLocationsByAssetID: TPendingLocationsByAssetID;
	error: string | null;
	setError: (value: string | null) => void;
	setSelectedAssets: Dispatch<SetStateAction<TAssetRow[]>>;
	setPendingLocation: Dispatch<SetStateAction<TPendingLocation | null>>;
	setSavedLocationsByAssetID: Dispatch<SetStateAction<TPendingLocationsByAssetID>>;
	toggleAsset: (asset: TAssetRow, mode?: TSelectMode) => void;
	shiftSelect: (asset: TAssetRow, allAssets: TAssetRow[]) => void;
	selectAll: (assets: TAssetRow[]) => void;
	clearSelection: () => void;
	setLocation: (options: TSetLocationOptions) => void;
	clearLocation: (clearPendingOnly?: boolean) => void;
	setPendingLocationsByAssetID: Dispatch<SetStateAction<TPendingLocationsByAssetID>>;
	undoLocation: () => void;
	redoLocation: () => void;
	canUndoLocation: boolean;
	canRedoLocation: boolean;
	beginLocationBatch: () => void;
	endLocationBatch: () => void;
};

/**
 * Centralizes selection state and low-level update operations.
 *
 * Maintains selected assets, pending map coordinates, and the anchor used for shift-range selection.
 */
export function useSelectionState(): TUseSelectionStateReturn {
	const [selectedAssets, setSelectedAssets] = useState<TAssetRow[]>([]);
	const [pendingLocation, setPendingLocation] = useState<TPendingLocation | null>(null);
	const [pendingLocationsByAssetID, setPendingLocationsByAssetID] = useState<TPendingLocationsByAssetID>({});
	const [savedLocationsByAssetID, setSavedLocationsByAssetID] = useState<TPendingLocationsByAssetID>({});
	const [error, setError] = useState<string | null>(null);
	const lastClickedID = useRef<string | null>(null);
	const selectedAssetsRef = useRef<TAssetRow[]>(selectedAssets);
	selectedAssetsRef.current = selectedAssets;

	const pendingLocationRef = useRef<TPendingLocation | null>(pendingLocation);
	pendingLocationRef.current = pendingLocation;
	const pendingLocationsByAssetIDRef = useRef<TPendingLocationsByAssetID>(pendingLocationsByAssetID);
	pendingLocationsByAssetIDRef.current = pendingLocationsByAssetID;
	const savedLocationsByAssetIDRef = useRef<TPendingLocationsByAssetID>(savedLocationsByAssetID);
	savedLocationsByAssetIDRef.current = savedLocationsByAssetID;

	const {
		pushUndo,
		popUndo,
		pushRedo,
		popRedo,
		canUndo: canUndoLocation,
		canRedo: canRedoLocation,
		clear: clearHistory,
		beginBatch: beginLocationBatch,
		endBatch: endLocationBatch
	} = useLocationHistory();

	const updateAnchor = useCallback((nextSelected: TAssetRow[]): void => {
		lastClickedID.current = resolveAnchorID(lastClickedID.current, nextSelected);
	}, []);

	const toggleAsset = useCallback(
		(asset: TAssetRow, mode: TSelectMode = 'single') => {
			if (mode === 'additive') {
				setSelectedAssets(prev => {
					const isSelected = prev.some(a => a.immichID === asset.immichID);
					if (isSelected) {
						const next = prev.filter(a => a.immichID !== asset.immichID);
						updateAnchor(next);
						return next;
					}
					updateAnchor([...prev, asset]);
					return [...prev, asset];
				});
			} else {
				setSelectedAssets(prev => {
					const isSelected = prev.some(a => a.immichID === asset.immichID);
					if (isSelected && prev.length === 1) {
						updateAnchor([]);
						return [];
					}
					updateAnchor([asset]);
					return [asset];
				});
			}

			if (mode !== 'additive' || pendingLocationRef.current?.source === 'marker-drag') {
				setPendingLocation(null);
			}
			setError(null);
		},
		[updateAnchor]
	);

	const shiftSelect = useCallback(
		(asset: TAssetRow, allAssets: TAssetRow[]) => {
			if (!lastClickedID.current) {
				toggleAsset(asset, 'single');
				return;
			}
			const anchorIdx = allAssets.findIndex(a => a.immichID === lastClickedID.current);
			const targetIdx = allAssets.findIndex(a => a.immichID === asset.immichID);
			if (anchorIdx === -1 || targetIdx === -1) {
				toggleAsset(asset, 'single');
				return;
			}

			const start = Math.min(anchorIdx, targetIdx);
			const end = Math.max(anchorIdx, targetIdx);
			const rangeAssets = allAssets.slice(start, end + 1);
			const rangeIDs = new Set(rangeAssets.map(a => a.immichID));

			setSelectedAssets(prev => {
				const isTargetSelected = prev.some(a => a.immichID === asset.immichID);
				let next = prev;
				if (isTargetSelected) {
					next = prev.filter(a => !rangeIDs.has(a.immichID));
				} else {
					const existingIDs = new Set(prev.map(a => a.immichID));
					next = [...prev];
					for (const item of rangeAssets) {
						if (!existingIDs.has(item.immichID)) {
							next.push(item);
						}
					}
				}
				updateAnchor(next);
				return next;
			});
			if (pendingLocationRef.current?.source === 'marker-drag') {
				setPendingLocation(null);
			}
			setError(null);
		},
		[updateAnchor, toggleAsset]
	);

	const selectAll = useCallback(
		(assets: TAssetRow[]) => {
			setSelectedAssets(() => {
				const next = [...assets];
				updateAnchor(next);
				if (next.length === 0) {
					return [];
				}
				return next;
			});
			if (pendingLocationRef.current?.source === 'marker-drag') {
				setPendingLocation(null);
			}
			setError(null);
		},
		[updateAnchor]
	);

	const clearSelection = useCallback(() => {
		setSelectedAssets([]);
		setPendingLocation(null);
		setPendingLocationsByAssetID({});
		setSavedLocationsByAssetID({});
		lastClickedID.current = null;
		setError(null);
		clearHistory();
	}, [
		setError,
		setPendingLocation,
		setPendingLocationsByAssetID,
		setSavedLocationsByAssetID,
		setSelectedAssets,
		clearHistory
	]);

	const clearLocation = useCallback(
		(clearPendingOnly?: boolean) => {
			setPendingLocation(null);
			if (!clearPendingOnly) {
				setPendingLocationsByAssetID({});
			}
			setError(null);
			if (!clearPendingOnly) {
				clearHistory();
			}
		},
		[clearHistory]
	);

	const captureSnapshot = useCallback((): TLocationSnapshot => {
		return {
			selectedAssets: selectedAssetsRef.current,
			pendingLocation: pendingLocationRef.current,
			pendingLocationsByAssetID: pendingLocationsByAssetIDRef.current,
			savedLocationsByAssetID: savedLocationsByAssetIDRef.current
		};
	}, []);

	const applySnapshot = useCallback(
		(snapshot: TLocationSnapshot) => {
			setSelectedAssets(snapshot.selectedAssets);
			updateAnchor(snapshot.selectedAssets);
			setPendingLocation(snapshot.pendingLocation);
			setPendingLocationsByAssetID(snapshot.pendingLocationsByAssetID);
			setSavedLocationsByAssetID(snapshot.savedLocationsByAssetID);
		},
		[setPendingLocation, setPendingLocationsByAssetID, setSavedLocationsByAssetID, setSelectedAssets, updateAnchor]
	);

	const setLocation = useCallback(
		(options: TSetLocationOptions) => {
			pushUndo(captureSnapshot());
			const selectedAssetIDs = selectedAssetsRef.current.map(asset => asset.immichID);
			const nextAssetIDs = buildTargetAssetIDs(options.targetAssetIDs, selectedAssetIDs);
			const nextPendingLocation = createPendingLocation(options);
			if (options.shouldSkipPendingLocation) {
				setPendingLocation(null);
			} else {
				setPendingLocation(nextPendingLocation);
			}
			setSavedLocationsByAssetID(prev => {
				const next = {...prev};
				for (const assetID of nextAssetIDs) {
					delete next[assetID];
				}
				return next;
			});
			if (nextAssetIDs.length > 0) {
				setPendingLocationsByAssetID(prev =>
					buildNextPendingLocations(prev, nextAssetIDs, nextPendingLocation, options)
				);
			}
			setError(null);
		},
		[captureSnapshot, pushUndo]
	);

	const undoLocation = useCallback(() => {
		const current = captureSnapshot();
		const previous = popUndo();
		if (!previous) {
			return;
		}
		pushRedo(current);
		applySnapshot(previous);
	}, [captureSnapshot, applySnapshot, popUndo, pushRedo]);

	const redoLocation = useCallback(() => {
		const current = captureSnapshot();
		const next = popRedo();
		if (!next) {
			return;
		}
		pushUndo(current, true);
		applySnapshot(next);
	}, [captureSnapshot, applySnapshot, popRedo, pushUndo]);

	return {
		selectedAssets,
		pendingLocation,
		pendingLocationsByAssetID,
		savedLocationsByAssetID,
		error,
		setError,
		setSelectedAssets,
		setPendingLocation,
		setSavedLocationsByAssetID,
		toggleAsset,
		shiftSelect,
		selectAll,
		clearSelection,
		setLocation,
		clearLocation,
		setPendingLocationsByAssetID,
		undoLocation,
		redoLocation,
		canUndoLocation,
		canRedoLocation,
		beginLocationBatch,
		endLocationBatch
	};
}
