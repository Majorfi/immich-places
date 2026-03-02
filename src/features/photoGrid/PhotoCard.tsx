'use client';

import Image from 'next/image';
import {useRef, useState} from 'react';

import {useUIMap} from '@/shared/context/AppContext';
import {thumbnailURL} from '@/utils/backendUrls';
import {DRAG_DROP_EFFECT_MOVE, DRAG_DROP_MIME_TEXT} from '@/utils/dragDrop';

import {PhotoCardMenu} from './PhotoCardMenu';

import type {TAssetRow} from '@/shared/types/asset';
import type {DragEvent, ReactElement} from 'react';

type TPhotoCardProps = {
	asset: TAssetRow;
	isSelected: boolean;
	isAlreadyApplied: boolean;
	onShiftSelectAction: (asset: TAssetRow) => void;
	onToggleAssetAction: (asset: TAssetRow, mode?: 'single' | 'additive') => void;
};

/**
 * Renders one photo tile, including thumbnail, selection indicator, and interactions.
 *
 * Supports click-select behaviors and drag start payload emission for map drops.
 *
 * @param props - Asset payload and selection callbacks.
 * @returns A card wrapped in the context menu.
 */
export function PhotoCard({
	asset,
	isSelected,
	isAlreadyApplied,
	onShiftSelectAction,
	onToggleAssetAction
}: TPhotoCardProps): ReactElement {
	const ref = useRef<HTMLDivElement>(null);
	const [isImageLoaded, setIsImageLoaded] = useState(false);
	const {openLightboxAction} = useUIMap();
	let imageClassName = 'absolute inset-0 opacity-0 object-cover';
	if (isImageLoaded) {
		imageClassName = 'object-cover';
	}

	function handlePreviewAction(event: React.MouseEvent<HTMLButtonElement>): void {
		event.stopPropagation();
		openLightboxAction(asset.immichID);
	}

	/**
	 * Serializes asset ID for drag operations started from the tile.
	 *
	 * @param event - Browser drag event.
	 */
	function handleDragStart(event: DragEvent<HTMLDivElement>): void {
		event.dataTransfer.setData(DRAG_DROP_MIME_TEXT, asset.immichID);
		event.dataTransfer.effectAllowed = DRAG_DROP_EFFECT_MOVE;
	}

	return (
		<PhotoCardMenu
			asset={asset}
			isSelected={isSelected}>
			<div
				ref={ref}
				className={'relative cursor-pointer select-none overflow-hidden rounded-xs hover:opacity-[0.85]'}
				onClick={e => {
					if (e.shiftKey) {
						onShiftSelectAction(asset);
					} else if (e.metaKey || e.ctrlKey) {
						onToggleAssetAction(asset, 'additive');
					} else {
						onToggleAssetAction(asset, 'single');
					}
				}}
				draggable
				onDragStart={handleDragStart}>
				<div className={'relative aspect-square w-full overflow-hidden bg-(--color-border)'}>
					{!isImageLoaded && (
						<div
							className={
								'h-full w-full bg-[linear-gradient(90deg,var(--color-border)_25%,var(--color-surface)_50%,var(--color-border)_75%)] bg-size-[200%_100%] animate-[shimmer_1.5s_infinite_ease-in-out]'
							}
						/>
					)}
					<Image
						src={thumbnailURL(asset.immichID)}
						alt={''}
						unoptimized
						loading={'lazy'}
						fill
						sizes={'20vw'}
						onLoad={() => setIsImageLoaded(true)}
						className={imageClassName}
					/>
					<button
						type={'button'}
						className={
							'absolute right-1 bottom-1 z-10 flex size-6 items-center justify-center rounded-full bg-black/65 p-0 text-white transition-all duration-150 hover:bg-black/80'
						}
						onClick={handlePreviewAction}
						title={'Open image'}>
						<svg
							width={'13'}
							height={'13'}
							viewBox={'0 0 15 15'}
							fill={'none'}
							xmlns={'http://www.w3.org/2000/svg'}
							aria-hidden={'true'}>
							<path
								d={
									'M13.5 9.4V11.6C13.5 12.45 12.8 13.15 11.95 13.15H3.55C2.7 13.15 2 12.45 2 11.6V3.55C2 2.7 2.7 2 3.55 2H6.05'
								}
								stroke={'currentColor'}
								strokeWidth={'1.2'}
								strokeLinecap={'round'}
								strokeLinejoin={'round'}
							/>
							<path
								d={'M12.9 2H8.2M13.1 2V6.7M13.1 2L6.9 8.2'}
								stroke={'currentColor'}
								strokeWidth={'1.2'}
								strokeLinecap={'round'}
								strokeLinejoin={'round'}
							/>
						</svg>
					</button>
				</div>
				<div
					className={`pointer-events-none absolute inset-0 z-1 flex items-center justify-center transition-[background] duration-150 ${
						isSelected ? 'bg-[rgba(33,97,66,0.35)]' : 'bg-[rgba(33,97,66,0)]'
					}`}>
					<div
						className={`flex size-5.5 items-center justify-center rounded-full bg-white transition-[opacity,transform] duration-150 ${
							isSelected ? 'scale-100 opacity-100' : 'scale-[0.6] opacity-0'
						}`}>
						<svg
							width={'14'}
							height={'14'}
							viewBox={'0 0 14 14'}
							fill={'none'}>
							<path
								d={'M3 7l3 3 5-5.5'}
								stroke={'#216142'}
								strokeWidth={'2'}
								strokeLinecap={'round'}
								strokeLinejoin={'round'}
							/>
						</svg>
					</div>
				</div>
				{isAlreadyApplied && !isSelected && (
					<div
						className={
							'pointer-events-none absolute inset-0 z-1 flex items-center justify-center bg-black/40 transition-[background] duration-150'
						}>
						<span className={'text-[0.6875rem] font-medium text-white/90'}>{'Already set'}</span>
					</div>
				)}
			</div>
		</PhotoCardMenu>
	);
}
