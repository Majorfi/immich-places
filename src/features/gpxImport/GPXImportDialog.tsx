'use client';

import {useCallback, useEffect, useRef, useState} from 'react';

import {DialogShell} from '@/shared/components/DialogShell';

import type {ReactElement} from 'react';

type TGPXImportDialogProps = {
	isOpen: boolean;
	onClose: () => void;
	uploadAndPreview: (files: File[], maxGapSeconds?: number) => Promise<void>;
	isLoading: boolean;
	error: string | null;
};

const inputClass =
	'h-7 w-full rounded-md border border-(--color-border) bg-transparent px-2 text-xs text-(--color-text) focus:border-(--color-primary) focus:outline-none';

export function GPXImportDialog({
	isOpen,
	onClose,
	uploadAndPreview,
	isLoading,
	error
}: TGPXImportDialogProps): ReactElement {
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const [maxGap, setMaxGap] = useState(600);
	const [isDragOver, setIsDragOver] = useState(false);
	const [dropError, setDropError] = useState<string | null>(null);

	useEffect(() => {
		if (!isOpen) {
			setMaxGap(600);
			setIsDragOver(false);
			setDropError(null);
			if (fileInputRef.current) {
				fileInputRef.current.value = '';
			}
		}
	}, [isOpen]);

	const handleFilesSelected = useCallback(
		(files: File[]) => {
			void uploadAndPreview(files, maxGap);
		},
		[uploadAndPreview, maxGap]
	);

	const handleInputChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const fileList = e.target.files;
			if (!fileList || fileList.length === 0) {
				return;
			}
			handleFilesSelected(Array.from(fileList));
		},
		[handleFilesSelected]
	);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			setIsDragOver(false);
			setDropError(null);
			const fileList = e.dataTransfer.files;
			if (!fileList || fileList.length === 0) {
				return;
			}
			const gpxFiles = Array.from(fileList).filter(f => f.name.endsWith('.gpx'));
			if (gpxFiles.length === 0) {
				setDropError('Only .gpx files are supported');
				return;
			}
			handleFilesSelected(gpxFiles);
		},
		[handleFilesSelected]
	);

	const dropzoneBaseClass =
		'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors';
	let dropzoneClass = `${dropzoneBaseClass} border-(--color-border) hover:border-(--color-text-secondary)`;
	if (isDragOver) {
		dropzoneClass = `${dropzoneBaseClass} border-(--color-primary) bg-(--color-primary)/5`;
	}
	let dropzoneLabel = 'Drop .gpx files or click to browse';
	if (isLoading) {
		dropzoneLabel = 'Processing...';
	}

	return (
		<DialogShell
			isOpen={isOpen}
			onClose={onClose}
			title={'Import GPX'}
			subtitle={'Match photos to a GPX track.'}
			maxWidth={'sm'}>
			<div className={'px-4 py-3'}>
				{(error || dropError) && (
					<div className={'mb-3 rounded-lg bg-[#fef2f2] px-3 py-2 text-xs text-[#b91c1c]'}>
						{error || dropError}
					</div>
				)}

				<div className={'flex flex-col gap-3'}>
					<div
						role={'button'}
						tabIndex={isLoading ? -1 : 0}
						aria-disabled={isLoading}
						onDragOver={e => {
							e.preventDefault();
							if (!isLoading) {
								setIsDragOver(true);
							}
						}}
						onDragLeave={() => setIsDragOver(false)}
						onDrop={e => {
							if (isLoading) {
								e.preventDefault();
								setIsDragOver(false);
								return;
							}
							handleDrop(e);
						}}
						onClick={() => {
							if (!isLoading) {
								fileInputRef.current?.click();
							}
						}}
						onKeyDown={e => {
							if ((e.key === 'Enter' || e.key === ' ') && !isLoading) {
								e.preventDefault();
								fileInputRef.current?.click();
							}
						}}
						className={dropzoneClass}>
						<svg
							width={'24'}
							height={'24'}
							viewBox={'0 0 24 24'}
							fill={'none'}
							stroke={'currentColor'}
							strokeWidth={'1.5'}
							className={'mb-1.5 text-(--color-text-secondary)'}>
							<path d={'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'} />
							<polyline points={'17 8 12 3 7 8'} />
							<line
								x1={'12'}
								y1={'3'}
								x2={'12'}
								y2={'15'}
							/>
						</svg>
						<p className={'text-xs text-(--color-text-secondary)'}>{dropzoneLabel}</p>
					</div>
					<input
						ref={fileInputRef}
						type={'file'}
						accept={'.gpx'}
						multiple
						onChange={handleInputChange}
						className={'hidden'}
					/>

					<div className={'rounded-lg bg-(--color-bg) p-2.5'}>
						<div
							className={
								'mb-2 text-[0.5625rem] font-semibold uppercase tracking-[0.08em] text-(--color-text-secondary)'
							}>
							{'Settings'}
						</div>
						<div>
							<label className={'mb-1 block text-[0.625rem] text-(--color-text-secondary)'}>
								{'Max Gap (sec)'}
							</label>
							<input
								type={'number'}
								value={maxGap}
								onChange={e => {
									const parsed = Number(e.target.value);
									if (Number.isFinite(parsed) && parsed >= 0) {
										setMaxGap(parsed);
									}
								}}
								min={0}
								className={inputClass}
							/>
						</div>
					</div>
				</div>
			</div>
		</DialogShell>
	);
}
