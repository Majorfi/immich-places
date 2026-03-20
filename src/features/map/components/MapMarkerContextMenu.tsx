'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {useCallback, useEffect} from 'react';

import {useBackend} from '@/shared/context/AppContext';
import {immichPhotoURL} from '@/utils/backendUrls';

import type {TMapContextMenuState} from '@/shared/types/map';
import type {ReactElement} from 'react';

type TMapMarkerContextMenuProps = {
	menu: TMapContextMenuState;
	onCloseAction: () => void;
	onPreviewAction: (assetID: string) => void;
	onResetPositionAction?: (assetID: string, originalLatitude: number, originalLongitude: number) => void;
};

const MENU_ITEM_CLASS =
	'flex cursor-pointer select-none items-center rounded-sm px-2.5 py-1.5 text-[0.8125rem] text-(--color-text) outline-none data-highlighted:bg-(--color-hover)';

const MENU_CONTENT_CLASS =
	'z-9999 min-w-40 rounded-md border border-(--color-border) bg-(--color-surface) p-1 shadow-[0_4px_12px_rgba(0,0,0,0.12)] animate-[fadeInMenu_0.12s_ease-out]';

export function MapMarkerContextMenu({
	menu,
	onCloseAction,
	onPreviewAction,
	onResetPositionAction
}: TMapMarkerContextMenuProps): ReactElement | null {
	const {health} = useBackend();
	const immichURL = health?.immichURL ?? '';

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
					{resetHandler && (
						<>
							<DropdownMenu.Separator className={'mx-1 my-1 h-px bg-(--color-border)'} />
							<DropdownMenu.Item
								className={MENU_ITEM_CLASS}
								onSelect={resetHandler}>
								{'Reset position'}
							</DropdownMenu.Item>
						</>
					)}
				</DropdownMenu.Content>
			</DropdownMenu.Portal>
		</DropdownMenu.Root>
	);
}
