'use client';

import {MEDIA_LABEL, mediaOptions} from '@/features/filterBar/constant';
import {useView} from '@/shared/context/AppContext';
import {cn} from '@/utils/cn';

import type {ReactElement} from 'react';

export function MediaFilterGroup(): ReactElement {
	const {mediaFilter, setMediaFilterAction} = useView();

	return (
		<div className={'flex-1 rounded-lg bg-(--color-bg) p-2.5'}>
			<div
				className={
					'mb-1 text-[0.5625rem] font-semibold uppercase tracking-[0.08em] text-(--color-text-secondary)'
				}>
				{'Media'}
			</div>
			<div className={'flex gap-1.5'}>
				{mediaOptions.map(option => {
					const isActive = mediaFilter === option;
					return (
						<button
							key={option}
							onClick={() => setMediaFilterAction(option)}
							disabled={isActive}
							className={cn(
								'rounded-md border px-2 py-1 text-[0.6875rem] font-medium transition-all duration-150',
								isActive && 'cursor-default',
								!isActive && 'cursor-pointer',
								isActive && 'border-(--color-primary) bg-(--color-selected) text-(--color-primary)',
								!isActive &&
									'border-(--color-border) bg-transparent text-(--color-text-secondary) hover:border-(--color-text-secondary)'
							)}>
							{MEDIA_LABEL[option]}
						</button>
					);
				})}
			</div>
		</div>
	);
}
