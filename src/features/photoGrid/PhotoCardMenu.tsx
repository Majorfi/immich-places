'use client';

import * as ContextMenu from '@radix-ui/react-context-menu';

import {useBackend, useCatalog, useSelection, useUIMap} from '@/shared/context/AppContext';
import {bulkToggleAssetHidden, toggleAssetHidden} from '@/shared/services/backendApi';
import {immichPhotoURL} from '@/utils/backendUrls';
import {MAP_LOCATION_SOURCE_GO_TO, MAP_LOCATION_SOURCE_REMOVE_LOCATION} from '@/utils/map';

import type {TAssetRow} from '@/shared/types/asset';
import type {ReactElement, ReactNode} from 'react';

type TPhotoCardMenuProps = {
	asset: TAssetRow;
	isSelected: boolean;
	children: ReactNode;
};

/**
 * Context menu actions bound to a photo tile.
 *
 * Provides selection commands, lightbox preview, and optional Immich external link
 * based on backend health configuration.
 *
 * @param props - Target asset and child trigger node.
 * @returns Context menu wrapper.
 */
export function PhotoCardMenu({asset, isSelected, children}: TPhotoCardMenuProps): ReactElement {
	const {health} = useBackend();
	const {assets, loadPageAction, currentPage} = useCatalog();
	const {
		selectedAssets,
		toggleAssetAction,
		selectAllAction,
		clearSelectionAction,
		setLocationAction,
		pendingLocationsByAssetID,
		beginLocationBatch,
		endLocationBatch
	} = useSelection();
	const {openLightboxAction} = useUIMap();

	const immichURL = health?.immichURL ?? '';
	const safeImmichPhotoURL = immichPhotoURL(immichURL, asset.immichID);

	/**
	 * Opens the current photo in an external Immich instance when configured.
	 */
	function handleOpenInImmich(): void {
		if (!safeImmichPhotoURL) {
			return;
		}
		window.open(safeImmichPhotoURL, '_blank', 'noopener,noreferrer');
	}

	const hasLocation = asset.latitude !== null && asset.longitude !== null;
	const isBulk = isSelected && selectedAssets.length > 1;
	const bulkCount = isBulk ? selectedAssets.length : 0;

	function isResettableEntry(assetID: string): boolean {
		const entry = pendingLocationsByAssetID[assetID];
		if (!entry) {
			return false;
		}
		return (
			entry.source === 'gpx-import' &&
			!entry.isAlreadyApplied &&
			entry.hasExistingLocation === true &&
			entry.originalLatitude != null &&
			entry.originalLongitude != null &&
			(entry.latitude !== entry.originalLatitude || entry.longitude !== entry.originalLongitude)
		);
	}

	function getResettableAssets(): TAssetRow[] {
		if (isBulk) {
			return selectedAssets.filter(a => isResettableEntry(a.immichID));
		}
		if (isResettableEntry(asset.immichID)) {
			return [asset];
		}
		return [];
	}

	const resettableAssets = getResettableAssets();
	const canResetPosition = resettableAssets.length > 0;

	function handleResetPosition(): void {
		if (resettableAssets.length === 0) {
			return;
		}

		beginLocationBatch();
		try {
			for (const a of resettableAssets) {
				const entry = pendingLocationsByAssetID[a.immichID]!;
				setLocationAction({
					latitude: entry.originalLatitude!,
					longitude: entry.originalLongitude!,
					source: 'gpx-import',
					targetAssetIDs: [a.immichID],
					shouldSkipPendingLocation: true,
					hasExistingLocation: true,
					isAlreadyApplied: true
				});
			}
		} finally {
			endLocationBatch();
		}
		selectAllAction([]);
	}

	function getRemovableAssets(): TAssetRow[] {
		if (isBulk) {
			return selectedAssets.filter(a => a.latitude !== null && a.longitude !== null);
		}
		if (hasLocation) {
			return [asset];
		}
		return [];
	}

	const removableAssets = getRemovableAssets();
	const canRemoveLocation = removableAssets.length > 0;

	function handleRemoveLocation(): void {
		if (removableAssets.length === 0) {
			return;
		}
		beginLocationBatch();
		try {
			for (const a of removableAssets) {
				setLocationAction({
					latitude: 0,
					longitude: 0,
					source: MAP_LOCATION_SOURCE_REMOVE_LOCATION,
					targetAssetIDs: [a.immichID],
					shouldSkipPendingLocation: true
				});
			}
		} finally {
			endLocationBatch();
		}
	}

	async function handleToggleHidden(): Promise<void> {
		try {
			if (isBulk) {
				const ids = selectedAssets.map(a => a.immichID);
				await bulkToggleAssetHidden(ids, !asset.isHidden);
				clearSelectionAction();
			} else {
				await toggleAssetHidden(asset.immichID, !asset.isHidden);
			}
			await loadPageAction(currentPage);
		} catch (err: unknown) {
			console.error('Failed to toggle hidden state:', err);
		}
	}

	return (
		<ContextMenu.Root>
			<ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
			<ContextMenu.Portal>
				<ContextMenu.Content
					className={
						'z-9999 min-w-40 rounded-md border border-(--color-border) bg-(--color-surface) p-1 shadow-[0_4px_12px_rgba(0,0,0,0.12)] animate-[fadeInMenu_0.12s_ease-out]'
					}>
					{isSelected ? (
						<ContextMenu.Item
							className={
								'flex cursor-pointer select-none items-center rounded-sm px-2.5 py-1.5 text-[0.8125rem] text-(--color-text) outline-none data-highlighted:bg-(--color-hover)'
							}
							onSelect={() => toggleAssetAction(asset, 'additive')}>
							{'Deselect'}
						</ContextMenu.Item>
					) : (
						<ContextMenu.Item
							className={
								'flex cursor-pointer select-none items-center rounded-sm px-2.5 py-1.5 text-[0.8125rem] text-(--color-text) outline-none data-highlighted:bg-(--color-hover)'
							}
							onSelect={() => toggleAssetAction(asset, 'single')}>
							{'Select'}
						</ContextMenu.Item>
					)}
					<ContextMenu.Item
						className={
							'flex cursor-pointer select-none items-center rounded-sm px-2.5 py-1.5 text-[0.8125rem] text-(--color-text) outline-none data-highlighted:bg-(--color-hover)'
						}
						onSelect={() => selectAllAction(assets)}>
						{'Select all'}
					</ContextMenu.Item>
					{selectedAssets.length > 0 && (
						<ContextMenu.Item
							className={
								'flex cursor-pointer select-none items-center rounded-sm px-2.5 py-1.5 text-[0.8125rem] text-(--color-text) outline-none data-highlighted:bg-(--color-hover)'
							}
							onSelect={clearSelectionAction}>
							{'Clear selection'}
						</ContextMenu.Item>
					)}
					<ContextMenu.Separator className={'my-1 h-px bg-(--color-border)'} />
					<ContextMenu.Item
						className={
							'flex cursor-pointer select-none items-center rounded-sm px-2.5 py-1.5 text-[0.8125rem] text-(--color-text) outline-none data-highlighted:bg-(--color-hover)'
						}
						onSelect={handleToggleHidden}>
						{asset.isHidden && !isBulk && 'Unhide'}
						{asset.isHidden && isBulk && `Unhide ${bulkCount} photos`}
						{!asset.isHidden && !isBulk && 'Hide'}
						{!asset.isHidden && isBulk && `Hide ${bulkCount} photos`}
					</ContextMenu.Item>
					<ContextMenu.Item
						className={
							'flex cursor-pointer select-none items-center rounded-sm px-2.5 py-1.5 text-[0.8125rem] text-(--color-text) outline-none data-highlighted:bg-(--color-hover)'
						}
						onSelect={() => {
							toggleAssetAction(asset, 'single');
							openLightboxAction(asset.immichID);
						}}>
						{'Preview'}
					</ContextMenu.Item>
					{hasLocation && (
						<ContextMenu.Item
							className={
								'flex cursor-pointer select-none items-center rounded-sm px-2.5 py-1.5 text-[0.8125rem] text-(--color-text) outline-none data-highlighted:bg-(--color-hover)'
							}
							onSelect={() => {
								setLocationAction({
									latitude: asset.latitude!,
									longitude: asset.longitude!,
									source: MAP_LOCATION_SOURCE_GO_TO
								});
							}}>
							{'Go to location'}
						</ContextMenu.Item>
					)}
					{canRemoveLocation && (
						<ContextMenu.Item
							className={
								'flex cursor-pointer select-none items-center rounded-sm px-2.5 py-1.5 text-[0.8125rem] text-(--color-text) outline-none data-highlighted:bg-(--color-hover)'
							}
							onSelect={handleRemoveLocation}>
							{!isBulk && 'Remove location'}
							{isBulk && `Remove location (${removableAssets.length})`}
						</ContextMenu.Item>
					)}
					{canResetPosition && (
						<ContextMenu.Item
							className={
								'flex cursor-pointer select-none items-center rounded-sm px-2.5 py-1.5 text-[0.8125rem] text-(--color-text) outline-none data-highlighted:bg-(--color-hover)'
							}
							onSelect={handleResetPosition}>
							{!isBulk && 'Reset position'}
							{isBulk && `Reset position (${resettableAssets.length})`}
						</ContextMenu.Item>
					)}
					{safeImmichPhotoURL && (
						<ContextMenu.Item
							className={
								'flex cursor-pointer select-none items-center rounded-sm px-2.5 py-1.5 text-[0.8125rem] text-(--color-text) outline-none data-highlighted:bg-(--color-hover)'
							}
							onSelect={handleOpenInImmich}>
							{'Open in Immich'}
						</ContextMenu.Item>
					)}
				</ContextMenu.Content>
			</ContextMenu.Portal>
		</ContextMenu.Root>
	);
}
