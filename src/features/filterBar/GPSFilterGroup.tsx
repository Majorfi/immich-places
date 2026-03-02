'use client';

import {GPS_LABEL, gpsOptions} from '@/features/filterBar/constants';
import {cn} from '@/utils/cn';
import {isGPSFilterWithoutLocations} from '@/utils/view';

import type {TGPSFilter} from '@/shared/types/map';
import type {ReactElement} from 'react';

/**
 * Props for a GPS filter choice group.
 */
type TGPSFilterGroupProps = {
	gpsFilter: TGPSFilter;
	missingCount: number | null;
	onGPSFilterAction: (filter: TGPSFilter) => void;
};

/**
 * Renders GPS filter buttons for "with" / "missing location".
 *
 * If an album set has missing coordinates, it can show a count badge on the
 * corresponding button.
 *
 * @param gpsFilter - Current GPS filter value.
 * @param missingCount - Missing-location photo count to display.
 * @param onGPSFilterAction - Callback invoked when user chooses a new filter.
 * @returns A button group UI for GPS filtering.
 */
export function GPSFilterGroup({gpsFilter, missingCount, onGPSFilterAction}: TGPSFilterGroupProps): ReactElement {
	return (
		<div className={'flex-1 rounded-lg bg-(--color-bg) p-2.5'}>
			<div
				className={
					'mb-1.5 rounded-md border border-[var(--color-border)] bg-(--color-selected) px-2 py-1.5 text-[0.6875rem] leading-4 text-(--color-text-secondary) md:hidden'
				}>
				{'Map editing is not available on mobile. Please use a desktop browser.'}
			</div>
			<div
				className={
					'mb-1 text-[0.5625rem] font-semibold uppercase tracking-[0.08em] text-(--color-text-secondary)'
				}>
				{'GPS Filter'}
			</div>
			<div className={'flex gap-1.5'}>
				{gpsOptions.map(option => {
					const isActive = gpsFilter === option;
					return (
						<button
							key={option}
							onClick={() => onGPSFilterAction(option)}
							disabled={isActive}
							className={cn(
								'relative rounded-md border px-2 py-1 text-[0.6875rem] font-medium transition-all duration-150',
								isActive && 'cursor-default',
								!isActive && 'cursor-pointer',
								isActive && 'border-(--color-primary) bg-(--color-selected) text-(--color-primary)',
								!isActive &&
									'border-(--color-border) bg-transparent text-(--color-text-secondary) hover:border-(--color-text-secondary)'
							)}>
							{GPS_LABEL[option]}
							{isGPSFilterWithoutLocations(option) && missingCount !== null && missingCount > 0 && (
								<span
									className={
										'absolute -top-2 -right-2 inline-flex min-w-4.5 items-center justify-center rounded-full bg-(--color-primary) px-1 text-[0.5625rem] font-semibold leading-4.5 text-white'
									}>
									{missingCount}
								</span>
							)}
						</button>
					);
				})}
			</div>
		</div>
	);
}
