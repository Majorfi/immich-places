'use client';

import 'leaflet.markercluster';
import 'leaflet.markercluster.placementstrategies';

import {AssetLightbox} from '@/features/lightbox/AssetLightbox';
import {MapControls} from '@/features/map/components/MapControls';
import {MapMarkerContextMenu} from '@/features/map/components/MapMarkerContextMenu';
import {MapOverlays} from '@/features/map/components/MapOverlays';
import {useMapViewController} from '@/features/map/hooks/useMapViewController';
import {useMapViewModel} from '@/features/map/hooks/useMapViewModel';
import {MAP_CONTROL_Z_INDEX} from '@/utils/map';

import type {ReactElement} from 'react';

/**
 * Main map feature view.
 *
 * Loads map model/controller state, renders map container, overlays, control actions,
 * error states, and shared lightbox.
 *
 * @returns Rendered map feature container.
 */
export function MapView(): ReactElement {
	const mapModel = useMapViewModel();
	const {mapMarkersError} = mapModel;

	const {
		containerRef,
		mapInteractionError,
		activeTileLayer,
		mapContextMenu,
		clearContextMenuAction,
		handleLocateMe,
		handleZoomIn,
		handleZoomOut,
		handleToggleTileLayer,
		handleDragOver,
		handleDrop
	} = useMapViewController({
		mapModel
	});

	return (
		<div
			className={'relative h-full w-full overflow-hidden rounded-xl border border-(--color-border)'}
			onDragOver={handleDragOver}
			onDrop={handleDrop}>
			<div
				ref={containerRef}
				className={'h-full w-full'}
			/>
			<MapOverlays />
			<MapControls
				activeTileLayer={activeTileLayer}
				onZoomInAction={handleZoomIn}
				onZoomOutAction={handleZoomOut}
				onLocateMeAction={handleLocateMe}
				onToggleTileLayerAction={handleToggleTileLayer}
			/>
			{(mapMarkersError || mapInteractionError) && (
				<div
					className={'pointer-events-none absolute right-4 bottom-16 flex max-w-[280px] flex-col gap-1'}
					style={{zIndex: MAP_CONTROL_Z_INDEX}}>
					{mapMarkersError && (
						<div
							className={
								'rounded-md bg-white/85 px-2 py-1 text-[0.6875rem] text-[#b91c1c] shadow-sm backdrop-blur-sm'
							}>
							{mapMarkersError}
						</div>
					)}
					{mapInteractionError && (
						<div
							className={
								'rounded-md bg-white/85 px-2 py-1 text-[0.6875rem] text-[#b91c1c] shadow-sm backdrop-blur-sm'
							}>
							{mapInteractionError}
						</div>
					)}
				</div>
			)}
			<AssetLightbox />
			<MapMarkerContextMenu
				menu={mapContextMenu}
				onCloseAction={clearContextMenuAction}
				onPreviewAction={mapModel.openLightboxAction}
			/>
		</div>
	);
}
