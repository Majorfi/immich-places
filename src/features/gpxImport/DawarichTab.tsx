'use client';

import {useCallback, useEffect, useRef} from 'react';

import {useDawarich} from '@/features/dawarich/useDawarich';
import {errorBannerClass} from '@/features/gpxImport/constant';

import type {TGPXPreviewResponse} from '@/features/gpxImport/gpxImportTypes';
import type {ReactElement} from 'react';

const buttonClass =
	'h-7 w-full cursor-pointer rounded-md border-0 bg-(--color-primary) px-3 text-xs font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50';

const secondaryButtonClass =
	'h-7 w-full cursor-pointer rounded-md border border-(--color-border) bg-transparent px-3 text-xs font-medium text-(--color-text-secondary) hover:bg-(--color-bg-hover) disabled:cursor-not-allowed disabled:opacity-50';

function LoadingSpinner(): ReactElement {
	return (
		<div className={'flex items-center justify-center'}>
			<svg
				className={'h-5 w-5 animate-spin text-(--color-text-secondary)'}
				viewBox={'0 0 24 24'}
				fill={'none'}>
				<circle
					cx={'12'}
					cy={'12'}
					r={'10'}
					stroke={'currentColor'}
					strokeWidth={'2'}
					className={'opacity-25'}
				/>
				<path
					d={'M4 12a8 8 0 0 1 8-8'}
					stroke={'currentColor'}
					strokeWidth={'2'}
					strokeLinecap={'round'}
				/>
			</svg>
		</div>
	);
}

function DawarichSyncingContent({
	currentTrack,
	totalTracks
}: {
	currentTrack: number | null;
	totalTracks: number | null;
}): ReactElement {
	let label = 'Syncing tracks from Dawarich...';
	if (currentTrack !== null && totalTracks !== null && totalTracks > 0) {
		label = `Syncing track ${currentTrack}/${totalTracks}...`;
	}

	return (
		<div className={'flex flex-1 flex-col items-center justify-center gap-3'}>
			<LoadingSpinner />
			<p className={'text-center text-xs text-(--color-text-secondary)'}>{label}</p>
		</div>
	);
}

function DawarichSyncContent({
	trackCount,
	isLoading,
	error,
	onPreview,
	onRefresh,
	maxGap
}: {
	trackCount: number;
	isLoading: boolean;
	error: string | null;
	onPreview: (maxGapSeconds: number) => void;
	onRefresh: () => void;
	maxGap: number;
}): ReactElement {
	let trackNoun = 'tracks';
	if (trackCount === 1) {
		trackNoun = 'track';
	}
	const trackLabel = `${trackCount} ${trackNoun} found in Dawarich.`;

	return (
		<div className={'flex flex-1 flex-col items-center justify-center'}>
			{error && <div className={`mb-3 ${errorBannerClass}`}>{error}</div>}

			{isLoading && <LoadingSpinner />}

			{!isLoading && trackCount === 0 && (
				<div className={'flex flex-col gap-3'}>
					<p className={'text-center text-xs text-(--color-text-secondary)'}>
						{'No tracks found in Dawarich.'}
					</p>
					<button
						onClick={onRefresh}
						className={secondaryButtonClass}>
						{'Refresh Tracks'}
					</button>
				</div>
			)}

			{!isLoading && trackCount > 0 && (
				<div className={'flex flex-col gap-3'}>
					<p className={'text-xs text-(--color-text-secondary)'}>{trackLabel}</p>
					<button
						onClick={() => onPreview(maxGap)}
						className={buttonClass}>
						{'Preview Matches'}
					</button>
					<button
						onClick={onRefresh}
						className={secondaryButtonClass}>
						{'Refresh Tracks'}
					</button>
				</div>
			)}
		</div>
	);
}

export function DawarichTab({
	hasDawarichCredentials,
	isOpen,
	onPreviewReady,
	onClose,
	onOpenAPIKeys,
	maxGap
}: {
	hasDawarichCredentials: boolean;
	isOpen: boolean;
	onPreviewReady: (previews: TGPXPreviewResponse[]) => void;
	onClose: () => void;
	onOpenAPIKeys: () => void;
	maxGap: number;
}): ReactElement {
	const dawarich = useDawarich(hasDawarichCredentials);

	useEffect(() => {
		if (isOpen && hasDawarichCredentials && dawarich.tracks.length === 0 && !dawarich.isLoading) {
			void dawarich.loadTracks();
		}
	}, [isOpen, hasDawarichCredentials]); // eslint-disable-line react-hooks/exhaustive-deps

	const didPreviewRef = useRef(false);

	useEffect(() => {
		if (!isOpen) {
			if (!didPreviewRef.current) {
				dawarich.reset();
			}
			didPreviewRef.current = false;
		}
	}, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

	const handlePreview = useCallback(
		async (maxGapSeconds: number) => {
			const allTrackIDs = dawarich.tracks.map(t => t.ID);
			const results = await dawarich.preview(allTrackIDs, maxGapSeconds);
			if (results.length > 0) {
				didPreviewRef.current = true;
				onPreviewReady(results);
				onClose();
			}
		},
		[dawarich.tracks, dawarich.preview, onPreviewReady, onClose] // eslint-disable-line react-hooks/exhaustive-deps
	);

	const handleRefresh = useCallback(() => {
		void dawarich.refreshSync();
	}, [dawarich.refreshSync]); // eslint-disable-line react-hooks/exhaustive-deps

	if (dawarich.step === 'setup') {
		return (
			<div className={'flex flex-1 flex-col items-center justify-center'}>
				<p className={'text-center text-xs text-(--color-text-secondary)'}>
					{'Add your Dawarich API key in '}
					<button
						type={'button'}
						onClick={() => {
							onClose();
							onOpenAPIKeys();
						}}
						className={
							'cursor-pointer border-0 bg-transparent p-0 text-xs text-(--color-primary) underline hover:opacity-80'
						}>
						{'API Keys'}
					</button>
					{' to get started.'}
				</p>
			</div>
		);
	}

	if (dawarich.step === 'syncing') {
		return (
			<DawarichSyncingContent
				currentTrack={dawarich.syncProgress?.currentTrack ?? null}
				totalTracks={dawarich.syncProgress?.totalTracks ?? null}
			/>
		);
	}

	return (
		<DawarichSyncContent
			trackCount={dawarich.tracks.length}
			isLoading={dawarich.isLoading}
			error={dawarich.error}
			onPreview={handlePreview}
			onRefresh={handleRefresh}
			maxGap={maxGap}
		/>
	);
}
