'use client';

import {VIEW_MODE_LABEL, viewModeOptions} from '@/features/filterBar/constant';
import {cn} from '@/utils/cn';

import type {TViewMode} from '@/shared/types/view';
import type {ReactElement} from 'react';

type TViewModeGroupProps = {
	viewMode: TViewMode;
	onViewModeAction: (mode: TViewMode) => void;
};

export function ViewModeGroup({viewMode, onViewModeAction}: TViewModeGroupProps): ReactElement {
	return (
		<div className={'flex-1 rounded-lg bg-(--color-bg) p-2.5'}>
			<div
				className={
					'mb-1 text-[0.5625rem] font-semibold uppercase tracking-[0.08em] text-(--color-text-secondary)'
				}>
				{'View'}
			</div>
			<div className={'flex gap-1.5'}>
				{viewModeOptions.map(option => {
					const isActive = viewMode === option;
					return (
						<button
							key={option}
							onClick={() => onViewModeAction(option)}
							disabled={isActive}
							className={cn(
								'rounded-md border px-2 py-1 text-[0.6875rem] font-medium transition-all duration-150',
								isActive && 'cursor-default',
								!isActive && 'cursor-pointer',
								isActive && 'border-(--color-primary) bg-(--color-selected) text-(--color-primary)',
								!isActive &&
									'border-(--color-border) bg-transparent text-(--color-text-secondary) hover:border-(--color-text-secondary)'
							)}>
							{VIEW_MODE_LABEL[option]}
						</button>
					);
				})}
			</div>
		</div>
	);
}
