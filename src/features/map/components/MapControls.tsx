'use client';

import {
	MAP_CONTROL_BUTTON_CLASS,
	MAP_CONTROL_ICON_BUTTON_STYLE,
	MAP_CONTROL_OFFSET,
	MAP_CONTROL_PANEL_CLASS,
	MAP_CONTROL_STACK_GAP
} from '@/features/map/constant';
import {MAP_CONTROL_Z_INDEX} from '@/utils/map';

import type {TMapTileLayer} from '@/utils/map';
import type {ReactElement} from 'react';

type TMapControlsProps = {
	activeTileLayer: TMapTileLayer;
	onZoomInAction: () => void;
	onZoomOutAction: () => void;
	onLocateMeAction: () => void;
	onToggleTileLayerAction: () => void;
};

/**
 * Floating map controls for zoom and geolocation actions.
 *
 * @param onZoomInAction - Increases map zoom.
 * @param onZoomOutAction - Decreases map zoom.
 * @param onLocateMeAction - Centers map on browser geolocation.
 * @returns Control button cluster.
 */
export function MapControls({
	activeTileLayer,
	onZoomInAction,
	onZoomOutAction,
	onLocateMeAction,
	onToggleTileLayerAction
}: TMapControlsProps): ReactElement {
	return (
		<>
			<div
				className={MAP_CONTROL_PANEL_CLASS}
				style={{
					top: MAP_CONTROL_OFFSET,
					right: MAP_CONTROL_OFFSET,
					zIndex: MAP_CONTROL_Z_INDEX,
					flexDirection: 'column',
					gap: MAP_CONTROL_STACK_GAP
				}}>
				<button
					className={MAP_CONTROL_BUTTON_CLASS}
					style={MAP_CONTROL_ICON_BUTTON_STYLE}
					onClick={onZoomInAction}
					title={'Zoom in'}>
					<svg
						width={'16'}
						height={'16'}
						viewBox={'0 0 16 16'}
						fill={'none'}>
						<path
							d={'M8 3v10M3 8h10'}
							stroke={'currentColor'}
							strokeWidth={'1.5'}
							strokeLinecap={'round'}
						/>
					</svg>
				</button>
				<button
					className={MAP_CONTROL_BUTTON_CLASS}
					style={MAP_CONTROL_ICON_BUTTON_STYLE}
					onClick={onZoomOutAction}
					title={'Zoom out'}>
					<svg
						width={'16'}
						height={'16'}
						viewBox={'0 0 16 16'}
						fill={'none'}>
						<path
							d={'M3 8h10'}
							stroke={'currentColor'}
							strokeWidth={'1.5'}
							strokeLinecap={'round'}
						/>
					</svg>
				</button>
			</div>
			<div
				className={MAP_CONTROL_PANEL_CLASS}
				style={{
					right: MAP_CONTROL_OFFSET,
					bottom: MAP_CONTROL_OFFSET,
					zIndex: MAP_CONTROL_Z_INDEX,
					flexDirection: 'row',
					gap: MAP_CONTROL_STACK_GAP
				}}>
				<button
					className={MAP_CONTROL_BUTTON_CLASS}
					style={MAP_CONTROL_ICON_BUTTON_STYLE}
					onClick={onLocateMeAction}
					title={'Center on my location'}>
					<svg
						width={'16'}
						height={'16'}
						viewBox={'0 0 16 16'}
						fill={'none'}>
						<circle
							cx={'8'}
							cy={'8'}
							r={'3'}
							stroke={'currentColor'}
							strokeWidth={'1.5'}
						/>
						<path
							d={'M8 1v3M8 12v3M1 8h3M12 8h3'}
							stroke={'currentColor'}
							strokeWidth={'1.5'}
							strokeLinecap={'round'}
						/>
					</svg>
				</button>
				<button
					className={MAP_CONTROL_BUTTON_CLASS}
					style={MAP_CONTROL_ICON_BUTTON_STYLE}
					onClick={onToggleTileLayerAction}
					title={activeTileLayer === 'street' ? 'Switch to satellite' : 'Switch to street'}>
					<svg
						width={'16'}
						height={'16'}
						viewBox={'0 0 16 16'}
						fill={'none'}>
						{activeTileLayer === 'street' ? (
							<>
								<rect
									x={'1'}
									y={'3'}
									width={'14'}
									height={'10'}
									rx={'1.5'}
									stroke={'currentColor'}
									strokeWidth={'1.5'}
								/>
								<circle
									cx={'5'}
									cy={'7'}
									r={'1.5'}
									stroke={'currentColor'}
									strokeWidth={'1'}
								/>
								<path
									d={'M1 11l4-3 3 2 4-4 3 3'}
									stroke={'currentColor'}
									strokeWidth={'1'}
									strokeLinecap={'round'}
									strokeLinejoin={'round'}
								/>
							</>
						) : (
							<>
								<path
									d={'M2 4h12M2 8h12M2 12h12'}
									stroke={'currentColor'}
									strokeWidth={'1.5'}
									strokeLinecap={'round'}
								/>
								<path
									d={'M5 2v12M11 2v12'}
									stroke={'currentColor'}
									strokeWidth={'1.5'}
									strokeLinecap={'round'}
								/>
							</>
						)}
					</svg>
				</button>
			</div>
		</>
	);
}
