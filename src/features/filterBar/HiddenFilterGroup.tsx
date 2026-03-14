'use client';

import {HIDDEN_LABEL, hiddenOptions} from '@/features/filterBar/constant';
import {cn} from '@/utils/cn';

import type {THiddenFilter} from '@/shared/types/map';
import type {ReactElement} from 'react';

type THiddenFilterGroupProps = {
	hiddenFilter: THiddenFilter;
	onHiddenFilterAction: (filter: THiddenFilter) => void;
};

export function HiddenFilterGroup({hiddenFilter, onHiddenFilterAction}: THiddenFilterGroupProps): ReactElement {
	return (
		<div className={'flex-1 rounded-lg bg-(--color-bg) p-2.5'}>
			<div
				className={
					'mb-1 text-[0.5625rem] font-semibold uppercase tracking-[0.08em] text-(--color-text-secondary)'
				}>
				{'Visibility'}
			</div>
			<div className={'flex gap-1.5'}>
				{hiddenOptions.map(option => {
					const isActive = hiddenFilter === option;
					return (
						<button
							key={option}
							onClick={() => onHiddenFilterAction(option)}
							disabled={isActive}
							className={cn(
								'rounded-md border px-2 py-1 text-[0.6875rem] font-medium transition-all duration-150',
								isActive && 'cursor-default',
								!isActive && 'cursor-pointer',
								isActive && 'border-(--color-primary) bg-(--color-selected) text-(--color-primary)',
								!isActive &&
									'border-(--color-border) bg-transparent text-(--color-text-secondary) hover:border-(--color-text-secondary)'
							)}>
							{HIDDEN_LABEL[option]}
						</button>
					);
				})}
			</div>
		</div>
	);
}
