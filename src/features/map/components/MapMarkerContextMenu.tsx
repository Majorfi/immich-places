'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {useCallback, useEffect} from 'react';

import {useAssetFolderPath} from '@/features/map/hooks/useAssetFolderPath';
import {useDiscardPendingLocations} from '@/features/selection/useDiscardPendingLocations';
import {useBackend, useView} from '@/shared/context/AppContext';
import {immichPhotoURL} from '@/utils/backendUrls';
import {GPS_FILTER_ALL} from '@/utils/view';

import type {TMapContextMenuState} from '@/shared/types/map';
import type {ReactElement} from 'react';

type TMapMarkerContextMenuProps = {
	menu: TMapContextMenuState;
	onCloseAction: () => void;
	onPreviewAction: (assetID: string) => void;
	onResetPositionAction?: (assetID: string, originalLatitude: number, originalLongitude: number) => void;
	onRemoveLocationAction?: (assetID: string) => void;
};

const MENU_ITEM_CLASS =
	'flex cursor-pointer select-none items-center rounded-sm px-2.5 py-1.5 text-[0.8125rem] text-(--color-text) outline-none data-highlighted:bg-(--color-hover)';

const MENU_CONTENT_CLASS =
	'z-9999 min-w-40 rounded-md border border-(--color-border) bg-(--color-surface) p-1 shadow-[0_4px_12px_rgba(0,0,0,0.12)] animate-[fadeInMenu_0.12s_ease-out]';

export function MapMarkerContextMenu({
	menu,
	onCloseAction,
	onPreviewAction,
	onResetPositionAction,
	onRemoveLocationAction
}: TMapMarkerContextMenuProps): ReactElement | null {
	const {health} = useBackend();
	const {setGPSFilterAction, setViewModeAction, selectAlbumAction, selectFolderAction} = useView();
	const discardPendingLocationsAction = useDiscardPendingLocations();
	const immichURL = health?.immichURL ?? '';

	// Resolved before the early returns below, so the hook order stays stable.
	let markerAssetID: string | null = null;
	if (menu?.type === 'marker') {
		markerAssetID = menu.assetID;
	}
	const folderPath = useAssetFolderPath(markerAssetID);

	const handleOpenChange = useCallback(
		(open: boolean) => {
			if (!open) {
				onCloseAction();
			}
		},
		[onCloseAction]
	);

	useEffect(() => {
		if (!menu) {
			return;
		}
		function handleScroll(): void {
			onCloseAction();
		}
		window.addEventListener('scroll', handleScroll, {capture: true});
		return () => window.removeEventListener('scroll', handleScroll, {capture: true});
	}, [menu, onCloseAction]);

	if (!menu) {
		return null;
	}

	if (menu.type === 'cluster') {
		return (
			<DropdownMenu.Root
				open
				onOpenChange={handleOpenChange}>
				<DropdownMenu.Trigger asChild>
					<div style={{position: 'fixed', left: menu.x, top: menu.y, width: 0, height: 0}} />
				</DropdownMenu.Trigger>
				<DropdownMenu.Portal>
					<DropdownMenu.Content
						className={MENU_CONTENT_CLASS}
						align={'start'}
						sideOffset={0}>
						{menu.canSpiderfy && (
							<DropdownMenu.Item
								className={MENU_ITEM_CLASS}
								onSelect={() => {
									menu.onSpiderfy();
									onCloseAction();
								}}>
								{'Expand'}
							</DropdownMenu.Item>
						)}
						{!menu.canSpiderfy && (
							<DropdownMenu.Item
								className={MENU_ITEM_CLASS}
								onSelect={() => {
									menu.onZoom();
									onCloseAction();
								}}>
								{'Zoom in'}
							</DropdownMenu.Item>
						)}
					</DropdownMenu.Content>
				</DropdownMenu.Portal>
			</DropdownMenu.Root>
		);
	}

	let resetHandler: (() => void) | null = null;
	if (
		menu.canResetPosition &&
		onResetPositionAction &&
		menu.originalLatitude !== undefined &&
		menu.originalLongitude !== undefined
	) {
		const lat = menu.originalLatitude;
		const lng = menu.originalLongitude;
		const assetID = menu.assetID;
		resetHandler = () => {
			onResetPositionAction(assetID, lat, lng);
			onCloseAction();
		};
	}

	const safeImmichPhotoURL = immichPhotoURL(immichURL, menu.assetID);
	const hasLocationActions = resetHandler || onRemoveLocationAction;

	return (
		<DropdownMenu.Root
			open
			onOpenChange={handleOpenChange}>
			<DropdownMenu.Trigger asChild>
				<div style={{position: 'fixed', left: menu.x, top: menu.y, width: 0, height: 0}} />
			</DropdownMenu.Trigger>
			<DropdownMenu.Portal>
				<DropdownMenu.Content
					className={MENU_CONTENT_CLASS}
					align={'start'}
					sideOffset={0}>
					<DropdownMenu.Item
						className={MENU_ITEM_CLASS}
						onSelect={() => {
							onPreviewAction(menu.assetID);
							onCloseAction();
						}}>
						{'Preview'}
					</DropdownMenu.Item>
					{folderPath && (
						<DropdownMenu.Item
							className={MENU_ITEM_CLASS}
							onSelect={() => {
								// Leaving the current asset context, like every other view-mode
								// switch, so pending location edits must be confirmed first.
								discardPendingLocationsAction(() => {
									// Markers show regardless of the GPS filter, so switch to
									// "all": under "no-gps" the folder would open without the
									// photo that was just clicked.
									setGPSFilterAction(GPS_FILTER_ALL);
									setViewModeAction('folders');
									// The folders view ignores a selected album, and
									// applyURLToState drops it on reload: leaving it set would
									// desync live state from the URL.
									selectAlbumAction(null);
									selectFolderAction(folderPath);
								});
								onCloseAction();
							}}>
							{'Go to folder'}
						</DropdownMenu.Item>
					)}
					{safeImmichPhotoURL && (
						<DropdownMenu.Item
							className={MENU_ITEM_CLASS}
							onSelect={() => {
								window.open(safeImmichPhotoURL, '_blank', 'noopener,noreferrer');
								onCloseAction();
							}}>
							{'Open in Immich'}
						</DropdownMenu.Item>
					)}
					{hasLocationActions && <DropdownMenu.Separator className={'mx-1 my-1 h-px bg-(--color-border)'} />}
					{resetHandler && (
						<DropdownMenu.Item
							className={MENU_ITEM_CLASS}
							onSelect={resetHandler}>
							{'Reset position'}
						</DropdownMenu.Item>
					)}
					{onRemoveLocationAction && (
						<DropdownMenu.Item
							className={MENU_ITEM_CLASS}
							onSelect={() => {
								onRemoveLocationAction(menu.assetID);
								onCloseAction();
							}}>
							{'Remove location'}
						</DropdownMenu.Item>
					)}
				</DropdownMenu.Content>
			</DropdownMenu.Portal>
		</DropdownMenu.Root>
	);
}
