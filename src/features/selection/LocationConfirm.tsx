'use client';

import {useCallback, useEffect, useMemo, useState} from 'react';

import {SAVE_LOCATION_ERROR_MESSAGE} from '@/features/selection/constant';
import {useSelection} from '@/shared/context/AppContext';
import {LOCATION_CONFIRM_COORDINATES_DECIMALS} from '@/utils/locationAssignment';

import type {TPendingLocation} from '@/shared/types/map';
import type {ReactElement} from 'react';

/**
 * Floating confirmation bar for applying pending locations to edited assets.
 *
 * Displays edited count, pending coordinates, error state, and Save/Cancel actions.
 *
 * @returns Confirmation UI, or `null` when no unsaved edits exist.
 */
export function LocationConfirm(): ReactElement | null {
	const {
		pendingLocation,
		pendingLocationsByAssetID,
		selectedAssets,
		isSaving,
		saveError,
		saveAction,
		clearLocationAction,
		undoLocationAction,
		redoLocationAction,
		canUndoLocation,
		canRedoLocation
	} = useSelection();
	const [localSaveError, setLocalSaveError] = useState<string | null>(null);

	const pendingAssetIDs = useMemo(
		() =>
			Object.keys(pendingLocationsByAssetID).filter(
				assetID => !pendingLocationsByAssetID[assetID]?.isAlreadyApplied
			),
		[pendingLocationsByAssetID]
	);
	const allAlreadyAppliedGPXCount = useMemo(
		() =>
			Object.values(pendingLocationsByAssetID).filter(loc => loc.source === 'gpx-import' && loc.isAlreadyApplied)
				.length,
		[pendingLocationsByAssetID]
	);
	const pendingImageCount = pendingAssetIDs.length;
	const selectedImageCount = selectedAssets.length;
	const isAllAlreadyApplied = allAlreadyAppliedGPXCount > 0 && pendingImageCount === 0;
	const editedImageCount = pendingImageCount > 0 ? pendingImageCount : selectedImageCount;
	let editedImageLabel = 'photos';
	if (editedImageCount === 1) {
		editedImageLabel = 'photo';
	}

	const visibleError = saveError || localSaveError;
	const referencePendingLocation = useMemo<TPendingLocation | null>(() => {
		if (pendingLocation) {
			return pendingLocation;
		}
		if (pendingAssetIDs.length === 0) {
			return null;
		}
		return pendingLocationsByAssetID[pendingAssetIDs[0]] ?? null;
	}, [pendingAssetIDs, pendingLocation, pendingLocationsByAssetID]);
	const referenceCoordinateLabel = useMemo<string | null>(() => {
		const hasGPXEntries = pendingAssetIDs.some(
			assetID => pendingLocationsByAssetID[assetID]?.source === 'gpx-import'
		);
		if (pendingLocation && !hasGPXEntries) {
			return `${pendingLocation.latitude.toFixed(LOCATION_CONFIRM_COORDINATES_DECIMALS)}, ${pendingLocation.longitude.toFixed(LOCATION_CONFIRM_COORDINATES_DECIMALS)}`;
		}
		if (pendingAssetIDs.length === 0) {
			return null;
		}
		const seenCoordinates = new Set<string>();
		const firstLocation = pendingLocationsByAssetID[pendingAssetIDs[0]];
		if (!firstLocation) {
			return null;
		}
		seenCoordinates.add(`${firstLocation.latitude},${firstLocation.longitude}`);
		for (const assetID of pendingAssetIDs.slice(1)) {
			const location = pendingLocationsByAssetID[assetID];
			if (!location) {
				continue;
			}
			seenCoordinates.add(`${location.latitude},${location.longitude}`);
			if (seenCoordinates.size > 1) {
				if (firstLocation.sourceLabel) {
					return firstLocation.sourceLabel;
				}
				if (firstLocation.source === 'gpx-import') {
					return 'Coordinates from GPX';
				}
				return 'Multiple coordinates';
			}
		}
		if (firstLocation) {
			return `${firstLocation.latitude.toFixed(LOCATION_CONFIRM_COORDINATES_DECIMALS)}, ${firstLocation.longitude.toFixed(LOCATION_CONFIRM_COORDINATES_DECIMALS)}`;
		}
		return null;
	}, [pendingAssetIDs, pendingLocation, pendingLocationsByAssetID]);

	const handleSave = useCallback(async () => {
		setLocalSaveError(null);
		try {
			const result = await saveAction();
			if (result.status === 'partial') {
				setLocalSaveError(result.errorMessage);
			}
		} catch {
			setLocalSaveError(SAVE_LOCATION_ERROR_MESSAGE);
		}
	}, [saveAction]);

	const handleCancel = useCallback(() => {
		clearLocationAction();
	}, [clearLocationAction]);

	const isVisible =
		isAllAlreadyApplied ||
		((pendingImageCount > 0 || selectedImageCount > 0) && (referencePendingLocation !== null || canRedoLocation));
	const isKeyboardActive = selectedAssets.length > 0 && (canUndoLocation || canRedoLocation);

	useEffect(() => {
		if (!isKeyboardActive) {
			return;
		}
		const handler = (e: KeyboardEvent): void => {
			const target = e.target as HTMLElement;
			if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
				return;
			}
			const isUndoRedo = (e.metaKey || e.ctrlKey) && e.key === 'z';
			if (!isUndoRedo) {
				return;
			}
			e.preventDefault();
			if (e.shiftKey) {
				redoLocationAction();
			} else {
				undoLocationAction();
			}
		};
		window.addEventListener('keydown', handler);
		return () => window.removeEventListener('keydown', handler);
	}, [isKeyboardActive, undoLocationAction, redoLocationAction]);

	if (!isVisible) {
		return null;
	}

	let allAppliedLabel = ' photos';
	if (allAlreadyAppliedGPXCount === 1) {
		allAppliedLabel = ' photo';
	}

	if (isAllAlreadyApplied) {
		return (
			<div
				className={
					'w-full min-w-md flex items-center gap-3 rounded-lg bg-(--color-surface) px-4 py-2.5 shadow-[0_2px_8px_rgba(0,0,0,0.1)]'
				}>
				<div className={'flex min-w-0 flex-1 flex-col gap-0.5'}>
					<span className={'block truncate text-[0.8125rem] font-medium'}>
						{allAlreadyAppliedGPXCount}
						{allAppliedLabel}
						{' \u2014 All locations already set'}
					</span>
				</div>
				<div className={'flex shrink-0 items-center gap-2'}>
					<button
						className={
							'cursor-pointer rounded-md border border-(--color-border) bg-(--color-bg) px-3 py-1.5 text-[0.8125rem] text-(--color-text) transition-all duration-150 hover:border-(--color-text-secondary)'
						}
						onClick={handleCancel}>
						{'Dismiss'}
					</button>
				</div>
			</div>
		);
	}

	const shouldDisableSave = isSaving;

	return (
		<div
			className={
				'w-full min-w-md flex items-center gap-3 rounded-lg bg-(--color-surface) px-4 py-2.5 shadow-[0_2px_8px_rgba(0,0,0,0.1)]'
			}>
			<div className={'flex min-w-0 flex-1 flex-col gap-0.5'}>
				<span className={'block truncate text-[0.8125rem] font-medium'}>
					{editedImageCount}
					{' edited image'}
					{editedImageLabel === 'photos' ? 's' : ''}
				</span>
				<span className={'block font-mono text-[0.75rem] text-(--color-text-secondary)'}>
					{referenceCoordinateLabel}
					{allAlreadyAppliedGPXCount > 0 && (
						<span className={'ml-1.5 font-sans text-(--color-text-secondary)/60'}>
							{'('}
							{allAlreadyAppliedGPXCount}
							{' already set)'}
						</span>
					)}
				</span>
			</div>
			{visibleError && <div className={'text-[0.75rem] text-[#b91c1c]'}>{visibleError}</div>}
			<div className={'flex shrink-0 items-center gap-2'}>
				<button
					className={
						'cursor-pointer rounded-md border border-(--color-border) bg-(--color-bg) p-1.5 text-(--color-text) transition-all duration-150 hover:border-(--color-text-secondary) disabled:cursor-not-allowed disabled:opacity-30'
					}
					onClick={undoLocationAction}
					disabled={!canUndoLocation || isSaving}
					title={'Undo (⌘Z)'}>
					<svg
						width={'16'}
						height={'16'}
						viewBox={'0 0 24 24'}
						fill={'none'}
						stroke={'currentColor'}
						strokeWidth={'2'}
						strokeLinecap={'round'}
						strokeLinejoin={'round'}>
						<path d={'M3 7v6h6'} />
						<path d={'M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6.69 3L3 13'} />
					</svg>
				</button>
				<button
					className={
						'cursor-pointer rounded-md border border-(--color-border) bg-(--color-bg) p-1.5 text-(--color-text) transition-all duration-150 hover:border-(--color-text-secondary) disabled:cursor-not-allowed disabled:opacity-30'
					}
					onClick={redoLocationAction}
					disabled={!canRedoLocation || isSaving}
					title={'Redo (⌘⇧Z)'}>
					<svg
						width={'16'}
						height={'16'}
						viewBox={'0 0 24 24'}
						fill={'none'}
						stroke={'currentColor'}
						strokeWidth={'2'}
						strokeLinecap={'round'}
						strokeLinejoin={'round'}>
						<path d={'M21 7v6h-6'} />
						<path d={'M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6.69 3L21 13'} />
					</svg>
				</button>
				<button
					className={
						'cursor-pointer rounded-md border border-(--color-border) bg-(--color-bg) px-3 py-1.5 text-[0.8125rem] text-(--color-text) transition-all duration-150 hover:border-(--color-text-secondary) disabled:cursor-not-allowed disabled:opacity-50'
					}
					onClick={handleCancel}
					disabled={shouldDisableSave}>
					{'Cancel'}
				</button>
				<button
					className={
						'cursor-pointer rounded-md border-0 bg-(--color-primary) px-3 py-1.5 text-[0.8125rem] font-medium text-white transition-opacity duration-150 hover:enabled:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'
					}
					onClick={handleSave}
					disabled={shouldDisableSave}>
					{isSaving ? 'Saving...' : 'Save Location'}
				</button>
			</div>
		</div>
	);
}
