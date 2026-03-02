'use client';

import {useRef} from 'react';

import {PHOTO_GRID_FADE_ANIMATION} from '@/features/photoGrid/constant';
import {PhotoCard} from '@/features/photoGrid/PhotoCard';
import {PhotoGridStatePanels} from '@/features/photoGrid/PhotoGridStatePanels';
import {usePhotoGridFocusScroll, usePhotoGridFocusSelection} from '@/features/photoGrid/useFocusedAsset';
import {useVirtualizedGrid} from '@/features/photoGrid/useVirtualizedGrid';
import {useSelection, useUIMap} from '@/shared/context/AppContext';
import {
	PHOTO_GRID_FADE_ANIMATION_BASE_DELAY_MS,
	PHOTO_GRID_FADE_ANIMATION_MAX_OFFSET,
	PHOTO_GRID_FADE_ANIMATION_STEP_MS,
	PHOTO_GRID_GAP_PX,
	PHOTO_GRID_PADDING_PX
} from '@/utils/photoGrid';

import type {TAssetRow} from '@/shared/types/asset';
import type {TGPSFilter} from '@/shared/types/map';
import type {ReactElement} from 'react';

/**
 * Build a reusable staggered animation style for one photo tile.
 *
 * @param delayMs - Delay in milliseconds before the fade-in animation begins.
 * @returns CSS animation settings used by `style`.
 */
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
};

/**
 * Renders the paginated photo grid with virtualization and focus handling.
 *
 * The component delegates row-windowing to `useVirtualizedGrid`, then renders
 * only visible assets with spacer rows to preserve scroll height.
 *
 * @param props - Data and state used to drive paging and selection.
 * @returns Rendered grid container including loading/error/empty states.
 */
export function PhotoGrid({
	assets,
	selectedIDs,
	alreadyAppliedIDs,
	scrollResetKey,
	gpsFilter,
	gridColumns,
	isLoading,
	isSyncing,
	error
}: TPhotoGridProps): ReactElement {
	const {focusedAssetID, clearFocusedAssetAction} = useUIMap();
	const {toggleAssetAction, shiftSelectAction} = useSelection();
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const {handleScroll, rowHeight, startIndex, visibleAssets, topSpacerHeight, bottomSpacerHeight, viewportHeight} =
		useVirtualizedGrid({assets, gridColumns, scrollResetKey, scrollContainerRef});

	usePhotoGridFocusSelection({
		focusedAssetID,
		assets,
		toggleAssetAction,
		clearFocusedAssetAction
	});
	usePhotoGridFocusScroll({
		focusedAssetID,
		assets,
		rowHeight,
		gridColumns,
		viewportHeight,
		scrollContainerRef
	});

	return (
		<div
			ref={scrollContainerRef}
			onScroll={handleScroll}
			className={'flex flex-1 flex-col overflow-y-auto'}>
			<PhotoGridStatePanels
				isLoading={isLoading}
				isSyncing={isSyncing}
				error={error}
				assetsCount={assets.length}
				gpsFilter={gpsFilter}
			/>

			<div
				aria-hidden
				style={{height: `${topSpacerHeight}px`}}
			/>
			<div
				className={'grid'}
				style={{
					gap: `${PHOTO_GRID_GAP_PX}px`,
					padding: `${PHOTO_GRID_PADDING_PX}px`,
					gridTemplateColumns: `repeat(${gridColumns}, 1fr)`
				}}>
				{visibleAssets.map((asset, i) => (
					<div
						key={asset.immichID}
						data-asset-id={asset.immichID}
						style={staggerStyle(
							PHOTO_GRID_FADE_ANIMATION_BASE_DELAY_MS +
								Math.min(startIndex + i, PHOTO_GRID_FADE_ANIMATION_MAX_OFFSET) *
									PHOTO_GRID_FADE_ANIMATION_STEP_MS
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
			<div
				aria-hidden
				style={{height: `${bottomSpacerHeight}px`}}
			/>
		</div>
	);
}
