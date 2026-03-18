'use client';

import {useEffect, useRef, useState} from 'react';

import {PhotoCard} from '@/features/photoGrid/PhotoCard';
import {PhotoGridStatePanels} from '@/features/photoGrid/PhotoGridStatePanels';
import {usePhotoGridFocusSelection} from '@/features/photoGrid/useFocusedAsset';
import {useSelection, useUIMap} from '@/shared/context/AppContext';
import {cn} from '@/utils/cn';
import {
	PHOTO_GRID_FADE_ANIMATION,
	PHOTO_GRID_FADE_ANIMATION_BASE_DELAY_MS,
	PHOTO_GRID_FADE_ANIMATION_MAX_OFFSET,
	PHOTO_GRID_FADE_ANIMATION_STEP_MS,
	PHOTO_GRID_GAP_PX,
	PHOTO_GRID_PADDING_PX
} from '@/utils/photoGrid';

import type {TAssetRow} from '@/shared/types/asset';
import type {TGPSFilter} from '@/shared/types/map';
import type {ReactElement} from 'react';

function staggerStyle(delayMs: number): {animation: string; animationDelay: string} {
	return {
		animation: PHOTO_GRID_FADE_ANIMATION,
		animationDelay: `${delayMs}ms`
	};
}

type TPhotoGridProps = {
	assets: TAssetRow[];
	selectedIDs: Set<string>;
	alreadyAppliedIDs: Set<string>;
	scrollResetKey: string;
	gpsFilter: TGPSFilter;
	gridColumns: number;
	isLoading: boolean;
	isSyncing: boolean;
	error: string | null;
	mobileMaxVisibleRows?: number | null;
};

export function PhotoGrid({
	assets,
	selectedIDs,
	alreadyAppliedIDs,
	scrollResetKey,
	gpsFilter,
	gridColumns,
	isLoading,
	isSyncing,
	error,
	mobileMaxVisibleRows
}: TPhotoGridProps): ReactElement {
	const {focusedAssetID, clearFocusedAssetAction} = useUIMap();
	const {toggleAssetAction, shiftSelectAction} = useSelection();
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const [isMobileViewport, setIsMobileViewport] = useState(false);

	usePhotoGridFocusSelection({
		focusedAssetID,
		assets,
		toggleAssetAction,
		clearFocusedAssetAction
	});

	useEffect(() => {
		if (!focusedAssetID) {
			return;
		}
		const container = scrollContainerRef.current;
		if (!container) {
			return;
		}
		const element = container.querySelector(`[data-asset-id="${focusedAssetID}"]`);
		if (element) {
			element.scrollIntoView({behavior: 'smooth', block: 'center'});
		}
	}, [focusedAssetID]);

	useEffect(() => {
		scrollContainerRef.current?.scrollTo(0, 0);
	}, [scrollResetKey]);

	useEffect(() => {
		const mediaQuery = window.matchMedia('(max-width: 767px)');
		const updateViewportFlag = (): void => {
			setIsMobileViewport(mediaQuery.matches);
		};
		updateViewportFlag();
		if (typeof mediaQuery.addEventListener === 'function') {
			mediaQuery.addEventListener('change', updateViewportFlag);
			return () => {
				mediaQuery.removeEventListener('change', updateViewportFlag);
			};
		}
		mediaQuery.addListener(updateViewportFlag);
		return () => {
			mediaQuery.removeListener(updateViewportFlag);
		};
	}, []);

	const isMobileGridHeightLimited =
		isMobileViewport && typeof mobileMaxVisibleRows === 'number' && mobileMaxVisibleRows > 0;
	let gridMaxHeightStyle: {maxHeight: string} | undefined;
	if (isMobileGridHeightLimited) {
		const fallbackRowHeight = 120;
		gridMaxHeightStyle = {
			maxHeight: `${Math.max(1, fallbackRowHeight * mobileMaxVisibleRows)}px`
		};
	}

	return (
		<div
			ref={scrollContainerRef}
			className={cn(
				'flex flex-col overflow-y-auto',
				!isMobileGridHeightLimited && 'flex-1',
				isMobileGridHeightLimited && 'shrink-0 md:flex-1'
			)}
			style={gridMaxHeightStyle}>
			<PhotoGridStatePanels
				isLoading={isLoading}
				isSyncing={isSyncing}
				error={error}
				assetsCount={assets.length}
				gpsFilter={gpsFilter}
			/>

			<div
				className={'grid'}
				style={{
					gap: `${PHOTO_GRID_GAP_PX}px`,
					padding: `${PHOTO_GRID_PADDING_PX}px`,
					gridTemplateColumns: `repeat(${gridColumns}, 1fr)`
				}}>
				{assets.map((asset, i) => (
					<div
						key={asset.immichID}
						data-asset-id={asset.immichID}
						style={staggerStyle(
							PHOTO_GRID_FADE_ANIMATION_BASE_DELAY_MS +
								Math.min(i, PHOTO_GRID_FADE_ANIMATION_MAX_OFFSET) * PHOTO_GRID_FADE_ANIMATION_STEP_MS
						)}>
						<PhotoCard
							asset={asset}
							isSelected={selectedIDs.has(asset.immichID)}
							isAlreadyApplied={alreadyAppliedIDs.has(asset.immichID)}
							onShiftSelectAction={selectedAsset => shiftSelectAction(selectedAsset, assets)}
							onToggleAssetAction={toggleAssetAction}
						/>
					</div>
				))}
			</div>
		</div>
	);
}
