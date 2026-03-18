'use client';

import {useEffect, useMemo, useRef} from 'react';

import {PhotoGrid} from '@/features/photoGrid/PhotoGrid';
import {deriveAlreadyAppliedIDs} from '@/features/selection/selectionStateHelpers';
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
	const {selectedAssets, setLocationAction, pendingLocationsByAssetID, beginLocationBatch, endLocationBatch} =
		useSelection();

	const selectedIDs = useMemo(() => new Set(selectedAssets.map(a => a.immichID)), [selectedAssets]);
	const alreadyAppliedIDs = useMemo(
		() => deriveAlreadyAppliedIDs(pendingLocationsByAssetID),
		[pendingLocationsByAssetID]
	);

	const mergedMatches = useMemo(() => mergeAndDeduplicateMatches(previews), [previews]);

	const gpxAssets = useMemo<TAssetRow[]>(
		() =>
			mergedMatches.map(match => ({
				immichID: match.assetID,
				type: 'IMAGE',
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
		[mergedMatches]
	);

	const detectedTimezones = useMemo(() => {
		const unique = new Set(previews.map(p => p.detectedTimezone).filter(Boolean));
		return Array.from(unique);
	}, [previews]);

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
					isAlreadyApplied: match.isAlreadyApplied
				});
			}
		} finally {
			endLocationBatch();
		}
	}, [mergedMatches, setLocationAction, beginLocationBatch, endLocationBatch]);

	const hasGPXPendingEntries = useMemo(
		() => Object.values(pendingLocationsByAssetID).some(loc => loc.source === 'gpx-import'),
		[pendingLocationsByAssetID]
	);
	const hadGPXEntriesRef = useRef(false);
	if (hasGPXPendingEntries) {
		hadGPXEntriesRef.current = true;
	}
	useEffect(() => {
		if (hadGPXEntriesRef.current && !hasGPXPendingEntries) {
			hadGPXEntriesRef.current = false;
			onReset();
		}
	}, [hasGPXPendingEntries, onReset]);

	return (
		<div className={'flex min-h-0 flex-1 flex-col'}>
			{detectedTimezones.length > 0 && (
				<div className={'mx-3 mt-2 text-[0.625rem] text-(--color-text-secondary)'}>
					{`Timezone: ${detectedTimezones.join(', ')}`}
				</div>
			)}
			{error && (
				<div className={'mx-3 mt-3 rounded-lg bg-[#fef2f2] px-3 py-2 text-xs text-[#b91c1c]'}>{error}</div>
			)}
			{mergedMatches.length === 0 && (
				<p className={'py-4 text-center text-xs text-(--color-text-secondary)'}>
					{'No photos matched. Try importing again with different settings.'}
				</p>
			)}
			{mergedMatches.length > 0 && (
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
