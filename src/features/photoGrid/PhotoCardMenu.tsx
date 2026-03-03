'use client';

import * as ContextMenu from '@radix-ui/react-context-menu';

import {useBackend, useCatalog, useSelection, useUIMap} from '@/shared/context/AppContext';
import {toggleAssetHidden} from '@/shared/services/backendApi';
import {immichPhotoURL} from '@/utils/backendUrls';

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
	const {selectedAssets, toggleAssetAction, selectAllAction, clearSelectionAction} = useSelection();
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

	async function handleToggleHidden(): Promise<void> {
		try {
			await toggleAssetHidden(asset.immichID, !asset.isHidden);
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
						{asset.isHidden && 'Unhide'}
						{!asset.isHidden && 'Hide'}
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
