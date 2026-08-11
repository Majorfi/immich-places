'use client';

import {EmptyState} from '@/shared/components/EmptyState';
import {isGPSFilterWithLocations, isGPSFilterWithoutLocations} from '@/utils/view';

import type {TGPSFilter} from '@/shared/types/map';
import type {ReactElement} from 'react';

type TPhotoGridStatePanelsProps = {
	isLoading: boolean;
	isSyncing: boolean;
	error: string | null;
	assetsCount: number;
	gpsFilter: TGPSFilter;
};

/**
 * Renders transient grid status panels for loading, sync, and empty states.
 *
 * @param props - Flags, error message, and current filter context.
 * @returns Conditional panel fragments displayed above the tile grid.
 */
export function PhotoGridStatePanels({
	isLoading,
	isSyncing,
	error,
	assetsCount,
	gpsFilter
}: TPhotoGridStatePanelsProps): ReactElement {
	const hasNoAssets = !isLoading && assetsCount === 0 && !error;
	let emptyMessage = 'No photos';
	if (isGPSFilterWithLocations(gpsFilter)) {
		emptyMessage = 'No geolocated photos';
	}

	return (
		<>
			{error && (
				<div className={'mx-4 my-2 rounded-md bg-[#fef2f2] px-2.5 py-2 text-[0.8125rem] text-[#b91c1c]'}>
					{error}
				</div>
			)}

			{hasNoAssets && isSyncing && (
				<div
					className={
						'flex flex-1 flex-col items-center justify-center gap-3 px-4 py-12 text-center text-[0.875rem] text-(--color-text-secondary)'
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
			)}

			{hasNoAssets && !isSyncing && isGPSFilterWithoutLocations(gpsFilter) && (
				<div className={'flex flex-1 items-center justify-center'}>
					<EmptyState />
				</div>
			)}

			{hasNoAssets && !isSyncing && !isGPSFilterWithoutLocations(gpsFilter) && (
				<div
					className={
						'flex flex-1 items-center justify-center px-4 py-12 text-center text-[0.875rem] text-(--color-text-secondary)'
					}
					style={{animation: 'elFadeIn 300ms ease-out both', animationDelay: '60ms'}}>
					{emptyMessage}
				</div>
			)}
		</>
	);
}
