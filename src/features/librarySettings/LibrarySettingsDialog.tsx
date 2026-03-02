'use client';

import {useCallback, useEffect, useState} from 'react';

import {DialogShell} from '@/shared/components/DialogShell';
import {fetchLibraries, refreshLibraries, updateLibrary} from '@/shared/services/backendApi';

import type {TLibraryRow} from '@/shared/types/library';
import type {ReactElement} from 'react';

let cachedLibraries: TLibraryRow[] = [];

export function clearLibraryCache(): void {
	cachedLibraries = [];
}

type TLibrarySettingsDialogProps = {
	isOpen: boolean;
	onClose: () => void;
	onVisibilityChanged: () => void;
};

export function LibrarySettingsDialog({
	isOpen,
	onClose,
	onVisibilityChanged
}: TLibrarySettingsDialogProps): ReactElement {
	const [libraries, setLibraries] = useState<TLibraryRow[]>(cachedLibraries);
	const [isLoading, setIsLoading] = useState(cachedLibraries.length === 0);
	const [error, setError] = useState<string | null>(null);
	const [togglingIDs, setTogglingIDs] = useState<Set<string>>(new Set());
	const [isRefreshing, setIsRefreshing] = useState(false);

	const loadLibraries = useCallback(async () => {
		if (cachedLibraries.length === 0) {
			setIsLoading(true);
		}
		setError(null);
		try {
			const result = await fetchLibraries();
			cachedLibraries = result;
			setLibraries(result);
		} catch {
			setError('Failed to load libraries');
		} finally {
			setIsLoading(false);
		}
	}, []);

	const handleRefresh = useCallback(async () => {
		setIsRefreshing(true);
		setError(null);
		try {
			const result = await refreshLibraries();
			cachedLibraries = result;
			setLibraries(result);
			onVisibilityChanged();
		} catch {
			setError('Failed to refresh libraries');
		} finally {
			setIsRefreshing(false);
		}
	}, [onVisibilityChanged]);

	useEffect(() => {
		if (isOpen) {
			loadLibraries();
		}
	}, [isOpen, loadLibraries]);

	const handleToggle = useCallback(
		async (libraryID: string, currentHidden: boolean) => {
			setTogglingIDs(previous => new Set(previous).add(libraryID));
			try {
				await updateLibrary(libraryID, !currentHidden);
				setLibraries(previous => {
					const updated = previous.map(lib => {
						if (lib.libraryID === libraryID) {
							return {...lib, isHidden: !currentHidden};
						}
						return lib;
					});
					cachedLibraries = updated;
					return updated;
				});
				onVisibilityChanged();
			} catch {
				setError('Failed to update library visibility');
			} finally {
				setTogglingIDs(previous => {
					const next = new Set(previous);
					next.delete(libraryID);
					return next;
				});
			}
		},
		[onVisibilityChanged]
	);

	let syncLabel = 'Sync';
	if (isRefreshing) {
		syncLabel = 'Syncing...';
	}

	const syncButton = (
		<button
			onClick={handleRefresh}
			disabled={isRefreshing || isLoading}
			className={
				'flex h-6 cursor-pointer items-center gap-1 rounded border border-(--color-border) bg-transparent px-2 text-xs text-(--color-text-secondary) hover:text-(--color-text) disabled:cursor-not-allowed disabled:opacity-50'
			}>
			{syncLabel}
		</button>
	);

	return (
		<DialogShell
			isOpen={isOpen}
			onClose={onClose}
			title={'External Libraries'}
			subtitle={'Hidden libraries are excluded from all views.'}
			headerTrailing={syncButton}>
			<div className={'max-h-80 min-h-16 overflow-y-auto px-4 py-3'}>
				{error && (
					<div className={'mb-3 rounded-md bg-[#fef2f2] px-3 py-2 text-xs text-[#b91c1c]'}>{error}</div>
				)}

				{isLoading && (
					<div className={'py-8 text-center text-sm text-(--color-text-secondary)'}>
						{'Loading libraries...'}
					</div>
				)}

				{!isLoading && libraries.length === 0 && !error && (
					<div className={'py-8 text-center text-sm text-(--color-text-secondary)'}>
						{'No external libraries found. Your Immich API key may not have admin permissions.'}
					</div>
				)}

				{!isLoading &&
					libraries.map(lib => {
						let toggleBackgroundClass = 'bg-(--color-primary)';
						if (lib.isHidden) {
							toggleBackgroundClass = 'bg-(--color-border)';
						}

						let knobPositionClass = 'translate-x-4';
						if (lib.isHidden) {
							knobPositionClass = 'translate-x-0';
						}

						return (
							<div
								key={lib.libraryID}
								className={
									'flex items-center justify-between border-b border-(--color-border) py-2.5 last:border-b-0'
								}>
								<div className={'min-w-0 flex-1'}>
									<p className={'truncate text-sm font-medium text-(--color-text)'}>{lib.name}</p>
									<p className={'text-xs text-(--color-text-secondary)'}>
										{`${lib.assetCount} assets`}
									</p>
								</div>
								<button
									onClick={async () => handleToggle(lib.libraryID, lib.isHidden)}
									disabled={togglingIDs.has(lib.libraryID)}
									className={`relative h-5 w-9 shrink-0 cursor-pointer rounded-full border-0 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${toggleBackgroundClass}`}>
									<span
										className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${knobPositionClass}`}
									/>
								</button>
							</div>
						);
					})}
			</div>
		</DialogShell>
	);
}
