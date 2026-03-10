'use client';

import {PlaceSearch} from '@/features/search/PlaceSearch';
import {LocationConfirm} from '@/features/selection/LocationConfirm';
import {SuggestionPanel} from '@/features/suggestions/SuggestionPanel';
import {MAP_CONTROL_OFFSET_PX, MAP_CONTROL_Z_INDEX, MAP_OVERLAY_BOTTOM_WIDTH} from '@/utils/map';

import type {ReactElement} from 'react';

/**
 * Map overlays rendered over the map canvas.
 *
 * Contains search and suggestion controls at the top and location confirmation
 * workflow near the bottom.
 *
 * @returns Overlay JSX nodes.
 */
export function MapOverlays(): ReactElement {
	const overlayOffset = `${MAP_CONTROL_OFFSET_PX / 16}rem`;

	return (
		<>
			<div
				className={
					'absolute left-2 right-[3.5rem] sm:left-1/2 sm:right-auto sm:w-[calc(100%-2rem)] sm:max-w-[720px] sm:-translate-x-1/2'
				}
				style={{
					top: overlayOffset,
					zIndex: MAP_CONTROL_Z_INDEX
				}}>
				<PlaceSearch />
				<SuggestionPanel />
			</div>
			<div
				className={'pointer-events-none absolute left-1/2 flex -translate-x-1/2 flex-col gap-2'}
				style={{
					bottom: overlayOffset,
					zIndex: MAP_CONTROL_Z_INDEX,
					width: MAP_OVERLAY_BOTTOM_WIDTH
				}}>
				<div className={'pointer-events-auto'}>
					<LocationConfirm />
				</div>
			</div>
		</>
	);
}
