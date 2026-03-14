'use client';

import {optionButtonClass} from '@/features/filterBar/constant';
import {cn} from '@/utils/cn';

import type {ReactElement} from 'react';

/**
 * Numeric option-group props for reusable segmented controls.
 */
type TNumericOptionGroupProps = {
	label: string;
	value: number;
	options: readonly number[];
	onChangeAction: (next: number) => void;
};

/**
 * Renders a compact numeric option selector used for page size and grid columns.
 *
 * @param label - Label displayed above the options.
 * @param value - Selected numeric value.
 * @param options - Allowed numeric values.
 * @param onChangeAction - Handler for option changes.
 * @returns A labeled set of option buttons.
 */
export function NumericOptionGroup({label, value, options, onChangeAction}: TNumericOptionGroupProps): ReactElement {
	return (
		<div className={'flex-1 rounded-lg bg-(--color-bg) p-2.5'}>
			<div
				className={
					'mb-1 text-[0.5625rem] font-semibold uppercase tracking-[0.08em] text-(--color-text-secondary)'
				}>
				{label}
			</div>
			<div className={'flex gap-1.5'}>
				{options.map(option => {
					const isActive = value === option;
					return (
						<button
							key={option}
							onClick={() => onChangeAction(option)}
							className={cn(
								optionButtonClass,
								isActive && 'border-(--color-primary) bg-(--color-selected) text-(--color-primary)',
								!isActive &&
									'border-(--color-border) bg-transparent text-(--color-text-secondary) hover:border-(--color-text-secondary)'
							)}>
							{option}
						</button>
					);
				})}
			</div>
		</div>
	);
}
