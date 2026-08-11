'use client';

import Image from 'next/image';

import {useCatalog, useView} from '@/shared/context/AppContext';
import {thumbnailURL} from '@/utils/backendUrls';
import {PHOTO_GRID_STAGGER_ANIMATION_MAX_OFFSET, PHOTO_GRID_STAGGER_ANIMATION_STEP_MS} from '@/utils/photoGrid';
import {isGPSFilterWithLocations, isGPSFilterWithoutLocations} from '@/utils/view';

import type {CSSProperties, ReactElement} from 'react';

/**
 * Props for the album list surface.
 * `onSelectAction` is called when an album card is clicked.
 * `animation` is an optional stagger animation name to apply to album cards.
 * `isSyncing` indicates whether the catalog is currently syncing with the backend.
 */
type TAlbumListProps = {
	onSelectAction: (albumID: string) => void;
	animation: string | null;
	isSyncing: boolean;
};

/**
 * Renders the album browse grid for the current catalog view.
 *
 * The component handles all catalog states: loading, error, empty result, and
 * populated results. Empty state messaging adapts to both syncing and location
 * filter states.
 *
 * @param props - Component input properties.
 *   - onSelectAction: Called with an album identifier when a card is clicked.
 *   - animation: Optional stagger animation name applied to cards.
 *   - isSyncing: Indicates whether the catalog is currently syncing.
 * @returns A React element representing the current album list state.
 */
export function AlbumList({onSelectAction, animation, isSyncing}: TAlbumListProps): ReactElement {
	const {albums, isLoadingAlbums, albumsError} = useCatalog();
	const {gpsFilter} = useView();

	if (isLoadingAlbums) {
		return (
			<div
				className={
					'flex items-center justify-center px-4 py-12 text-center text-[0.875rem] text-(--color-text-secondary)'
				}>
				{'Loading albums...'}
			</div>
		);
	}

	if (albumsError) {
		return (
			<div
				className={
					'flex items-center justify-center px-4 py-12 text-center text-[0.875rem] text-(--color-text-secondary)'
				}>
				{albumsError}
			</div>
		);
	}

	const visibleAlbums = isGPSFilterWithoutLocations(gpsFilter) ? albums.filter(a => a.filteredCount > 0) : albums;

	if (visibleAlbums.length === 0) {
		if (isSyncing) {
			return (
				<div
					className={
						'flex flex-col items-center justify-center gap-3 px-4 py-12 text-center text-[0.875rem] text-(--color-text-secondary)'
					}>
					<svg
						className={'h-6 w-6 animate-spin'}
						viewBox={'0 0 24 24'}
						fill={'none'}
						stroke={'currentColor'}
						strokeWidth={'2'}>
						<path d={'M21 12a9 9 0 1 1-6.219-8.56'} />
					</svg>
					{'Syncing with Immich...'}
				</div>
			);
		}
		let emptyMessage = 'No albums';
		if (isGPSFilterWithLocations(gpsFilter)) {
			emptyMessage = 'No albums with geolocated photos';
		} else if (isGPSFilterWithoutLocations(gpsFilter)) {
			emptyMessage = 'No albums with unlocated photos';
		}
		return (
			<div
				className={
					'flex items-center justify-center px-4 py-12 text-center text-[0.875rem] text-(--color-text-secondary)'
				}>
				{emptyMessage}
			</div>
		);
	}

	/**
	 * Computes per-card animation timing for the staggered card reveal animation.
	 *
	 * @param index - Index of the album card in the rendered list.
	 * @returns CSS style object when animation is active, otherwise undefined.
	 */
	function cardStyle(index: number): CSSProperties | undefined {
		if (!animation) {
			return undefined;
		}
		return {
			animation,
			animationDelay: `${PHOTO_GRID_STAGGER_ANIMATION_STEP_MS * Math.min(index, PHOTO_GRID_STAGGER_ANIMATION_MAX_OFFSET)}ms`
		};
	}

	return (
		<div className={'grid grid-cols-2 gap-1.5 p-1.5'}>
			{visibleAlbums.map((album, i) => (
				<div
					key={album.immichID}
					className={
						'flex cursor-pointer flex-col overflow-hidden rounded-lg transition-[background] duration-120 hover:bg-(--color-hover)'
					}
					style={cardStyle(i)}
					onClick={() => onSelectAction(album.immichID)}>
					<div className={'relative aspect-square w-full overflow-hidden rounded-lg bg-(--color-border)'}>
						{album.thumbnailAssetID && (
							<Image
								unoptimized
								src={thumbnailURL(album.thumbnailAssetID)}
								alt={''}
								loading={'lazy'}
								fill
								sizes={'50vw'}
								className={'h-full w-full object-cover'}
							/>
						)}
					</div>
					<div className={'px-1 py-1.5'}>
						<div className={'truncate text-[0.75rem] font-semibold'}>{album.albumName}</div>
						<div className={'mt-px text-[0.625rem] text-(--color-text-secondary)'}>
							{album.filteredCount} {'photos'}
						</div>
					</div>
				</div>
			))}
		</div>
	);
}
