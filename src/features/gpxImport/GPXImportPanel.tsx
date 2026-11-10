'use client';

import {useEffect, useMemo, useRef} from 'react';

import {errorBannerClass} from '@/features/gpxImport/constant';
import {PhotoGrid} from '@/features/photoGrid/PhotoGrid';
import {
	deriveAlreadyAppliedIDs,
	hasGPXPendingEntries,
	matchesGPXStatusFilter
} from '@/features/selection/selectionStateHelpers';
import {useSelection, useView} from '@/shared/context/AppContext';

import type {TGPXMatchResult, TGPXPreviewResponse} from '@/features/gpxImport/gpxImportTypes';
import type {TAssetRow} from '@/shared/types/asset';
import type {ReactElement} from 'react';

type TGPXImportPanelProps = {
	previews: TGPXPreviewResponse[];
	error: string | null;
	onReset: () => void;
};

function mergeAndDeduplicateMatches(previews: TGPXPreviewResponse[]): TGPXMatchResult[] {
	const bestByAssetID = new Map<string, TGPXMatchResult>();

	for (const preview of previews) {
		const trackName = preview.track.name || '';
		for (const match of preview.matches) {
			const stamped: TGPXMatchResult = {...match, trackName};
			const existing = bestByAssetID.get(match.assetID);
			if (!existing || Math.abs(stamped.timeGap) < Math.abs(existing.timeGap)) {
				bestByAssetID.set(match.assetID, stamped);
			}
		}
	}

	return Array.from(bestByAssetID.values());
}

export function GPXImportPanel({previews, error, onReset}: TGPXImportPanelProps): ReactElement {
	const {gridColumns, gpsFilter} = useView();
	const {
		selectedAssets,
		setLocationAction,
		pendingLocationsByAssetID,
		beginLocationBatch,
		endLocationBatch,
		gpxStatusFilter
	} = useSelection();

	const selectedIDs = useMemo(() => new Set(selectedAssets.map(a => a.immichID)), [selectedAssets]);
	const alreadyAppliedIDs = useMemo(
		() => deriveAlreadyAppliedIDs(pendingLocationsByAssetID),
		[pendingLocationsByAssetID]
	);

	const mergedMatches = useMemo(() => mergeAndDeduplicateMatches(previews), [previews]);

	const filteredMatches = useMemo(() => {
		return mergedMatches.filter(m =>
			matchesGPXStatusFilter(gpxStatusFilter, m.isAlreadyApplied, m.hasExistingLocation)
		);
	}, [mergedMatches, gpxStatusFilter]);

	const gpxAssets = useMemo<TAssetRow[]>(
		() =>
			filteredMatches.map(match => ({
				immichID: match.assetID,
				type: match.type,
				originalFileName: match.fileName,
				fileCreatedAt: '',
				latitude: match.latitude,
				longitude: match.longitude,
				city: null,
				state: null,
				country: null,
				dateTimeOriginal: null,
				syncedAt: '',
				isHidden: false
			})),
		[filteredMatches]
	);

	useEffect(() => {
		if (mergedMatches.length === 0) {
			return;
		}
		beginLocationBatch();
		try {
			for (const match of mergedMatches) {
				setLocationAction({
					latitude: match.latitude,
					longitude: match.longitude,
					source: 'gpx-import',
					targetAssetIDs: [match.assetID],
					shouldSkipPendingLocation: true,
					sourceLabel: match.trackName || '',
					isAlreadyApplied: match.isAlreadyApplied,
					hasExistingLocation: match.hasExistingLocation,
					originalLatitude: match.existingLatitude,
					originalLongitude: match.existingLongitude
				});
			}
		} finally {
			endLocationBatch();
		}
	}, [mergedMatches, setLocationAction, beginLocationBatch, endLocationBatch]);

	const hasGPXEntries = useMemo(() => hasGPXPendingEntries(pendingLocationsByAssetID), [pendingLocationsByAssetID]);
	const hadGPXEntriesRef = useRef(false);
	if (hasGPXEntries) {
		hadGPXEntriesRef.current = true;
	}
	useEffect(() => {
		if (hadGPXEntriesRef.current && !hasGPXEntries) {
			hadGPXEntriesRef.current = false;
			onReset();
		}
	}, [hasGPXEntries, onReset]);

	return (
		<div className={'flex min-h-0 flex-1 flex-col'}>
			{error && <div className={`mx-3 mt-3 ${errorBannerClass}`}>{error}</div>}
			{filteredMatches.length === 0 && (
				<p className={'py-4 text-center text-xs text-(--color-text-secondary)'}>
					{'No photos matched. Try importing again with different settings.'}
				</p>
			)}
			{filteredMatches.length > 0 && (
				<PhotoGrid
					assets={gpxAssets}
					selectedIDs={selectedIDs}
					alreadyAppliedIDs={alreadyAppliedIDs}
					scrollResetKey={'gpx-preview'}
					gpsFilter={gpsFilter}
					gridColumns={gridColumns}
					isLoading={false}
					isSyncing={false}
					error={null}
				/>
			)}
		</div>
	);
}
