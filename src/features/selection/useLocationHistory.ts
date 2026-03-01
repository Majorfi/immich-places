'use client';

import {useCallback, useRef, useState} from 'react';

import type {TAssetRow} from '@/shared/types/asset';
import type {TPendingLocation, TPendingLocationsByAssetID} from '@/shared/types/map';

const MAX_UNDO_STACK_SIZE = 50;

export type TLocationSnapshot = {
	selectedAssets: TAssetRow[];
	pendingLocation: TPendingLocation | null;
	pendingLocationsByAssetID: TPendingLocationsByAssetID;
	savedLocationsByAssetID: TPendingLocationsByAssetID;
};

type TUseLocationHistoryReturn = {
	pushUndo: (snapshot: TLocationSnapshot, preserveRedo?: boolean) => void;
	popUndo: () => TLocationSnapshot | null;
	pushRedo: (snapshot: TLocationSnapshot) => void;
	popRedo: () => TLocationSnapshot | null;
	peekUndo: () => TLocationSnapshot | null;
	canUndo: boolean;
	canRedo: boolean;
	clear: () => void;
	beginBatch: () => void;
	endBatch: () => void;
};

export function useLocationHistory(): TUseLocationHistoryReturn {
	const undoStackRef = useRef<TLocationSnapshot[]>([]);
	const redoStackRef = useRef<TLocationSnapshot[]>([]);
	const batchDepthRef = useRef(0);
	const batchSnapshotRef = useRef<TLocationSnapshot | null>(null);
	const [version, setVersion] = useState(0);

	const bump = useCallback(() => setVersion(v => v + 1), []);

	const pushUndo = useCallback(
		(snapshot: TLocationSnapshot, preserveRedo?: boolean) => {
			if (batchDepthRef.current > 0) {
				if (!batchSnapshotRef.current) {
					batchSnapshotRef.current = snapshot;
				}
				return;
			}
			undoStackRef.current.push(snapshot);
			if (undoStackRef.current.length > MAX_UNDO_STACK_SIZE) {
				undoStackRef.current.shift();
			}
			if (!preserveRedo) {
				redoStackRef.current = [];
			}
			bump();
		},
		[bump]
	);

	const popUndo = useCallback((): TLocationSnapshot | null => {
		const snapshot = undoStackRef.current.pop() ?? null;
		bump();
		return snapshot;
	}, [bump]);

	const peekUndo = useCallback((): TLocationSnapshot | null => {
		const stack = undoStackRef.current;
		if (stack.length === 0) {
			return null;
		}
		return stack[stack.length - 1];
	}, []);

	const pushRedo = useCallback(
		(snapshot: TLocationSnapshot) => {
			redoStackRef.current.push(snapshot);
			if (redoStackRef.current.length > MAX_UNDO_STACK_SIZE) {
				redoStackRef.current.shift();
			}
			bump();
		},
		[bump]
	);

	const popRedo = useCallback((): TLocationSnapshot | null => {
		const snapshot = redoStackRef.current.pop() ?? null;
		bump();
		return snapshot;
	}, [bump]);

	const clear = useCallback(() => {
		undoStackRef.current = [];
		redoStackRef.current = [];
		batchDepthRef.current = 0;
		batchSnapshotRef.current = null;
		bump();
	}, [bump]);

	const beginBatch = useCallback(() => {
		batchDepthRef.current += 1;
	}, []);

	const endBatch = useCallback(() => {
		batchDepthRef.current = Math.max(0, batchDepthRef.current - 1);
		if (batchDepthRef.current === 0 && batchSnapshotRef.current) {
			undoStackRef.current.push(batchSnapshotRef.current);
			if (undoStackRef.current.length > MAX_UNDO_STACK_SIZE) {
				undoStackRef.current.shift();
			}
			redoStackRef.current = [];
			batchSnapshotRef.current = null;
			bump();
		}
	}, [bump]);

	void version;

	return {
		pushUndo,
		popUndo,
		peekUndo,
		pushRedo,
		popRedo,
		canUndo: undoStackRef.current.length > 0,
		canRedo: redoStackRef.current.length > 0,
		clear,
		beginBatch,
		endBatch
	};
}
