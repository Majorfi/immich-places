'use client';

import {addMonths, endOfMonth, format, parseISO, startOfMonth, subMonths, subYears} from 'date-fns';
import {CalendarIcon} from 'lucide-react';
import {useCallback, useEffect, useRef, useState} from 'react';

import {Calendar} from '@/components/ui/calendar';
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover';
import {useView} from '@/shared/context/AppContext';
import {fetchAssetDayCounts} from '@/shared/services/backendApi';
import {cn} from '@/utils/cn';

import type {ComponentProps, ReactElement} from 'react';
import type {DateRange, DayButton} from 'react-day-picker';

type TDateRangeFilterGroupProps = {
	startDate: string | null;
	endDate: string | null;
	onDateRangeAction: (startDate: string | null, endDate: string | null) => void;
};

type TPreset = {
	label: string;
	startDate: string;
	endDate: string;
};

function buildPresets(): TPreset[] {
	const now = new Date();
	const today = format(now, 'yyyy-MM-dd');
	const currentYear = now.getFullYear();

	const presets: TPreset[] = [
		{label: 'Last month', startDate: format(subMonths(now, 1), 'yyyy-MM-dd'), endDate: today},
		{label: 'Last year', startDate: format(subYears(now, 1), 'yyyy-MM-dd'), endDate: today}
	];

	for (let year = currentYear; year >= currentYear - 4; year -= 1) {
		presets.push({
			label: String(year),
			startDate: `${year}-01-01`,
			endDate: `${year}-12-31`
		});
	}

	return presets;
}

const buttonBase =
	'cursor-pointer rounded-md border px-2 py-1 text-[0.6875rem] font-medium transition-all duration-150';
const buttonActive = 'cursor-default border-(--color-primary) bg-(--color-selected) text-(--color-primary)';
const buttonInactive =
	'border-(--color-border) bg-transparent text-(--color-text-secondary) hover:border-(--color-text-secondary)';

function matchesPreset(preset: TPreset, startDate: string | null, endDate: string | null): boolean {
	return startDate === preset.startDate && endDate === preset.endDate;
}

function resolvePresetButtonStyle(isActive: boolean): string {
	if (isActive) {
		return buttonActive;
	}
	return buttonInactive;
}

function resolveCustomButtonStyle(open: boolean, hasFilter: boolean, hasPresetMatch: boolean): string {
	if (open) {
		return buttonActive;
	}
	if (hasFilter && !hasPresetMatch) {
		return 'border-(--color-primary) bg-(--color-primary)/10 text-(--color-primary)';
	}
	return buttonInactive;
}

function isoToDateRange(startDate: string | null, endDate: string | null): DateRange | undefined {
	if (!startDate && !endDate) {
		return undefined;
	}
	let from: Date | undefined;
	let to: Date | undefined;
	if (startDate) {
		from = parseISO(startDate);
	}
	if (endDate) {
		to = parseISO(endDate);
	}
	return {from, to};
}

function formatRangeLabel(startDate: string | null, endDate: string | null): string {
	const parts: string[] = [];
	if (startDate) {
		parts.push(format(parseISO(startDate), 'MMM d, yyyy'));
	}
	if (endDate) {
		parts.push(format(parseISO(endDate), 'MMM d, yyyy'));
	}
	if (parts.length === 0) {
		return 'Custom range';
	}
	return parts.join(' – ');
}

function useDayCounts(visibleMonth: Date, open: boolean): Record<string, number> {
	const {gpsFilter, hiddenFilter, selectedAlbumID} = useView();
	const [counts, setCounts] = useState<Record<string, number>>({});
	const abortRef = useRef<AbortController | null>(null);

	const fetchCounts = useCallback(
		async (month: Date, signal: AbortSignal): Promise<void> => {
			const rangeStart = format(startOfMonth(subMonths(month, 1)), 'yyyy-MM-dd');
			const rangeEnd = format(endOfMonth(addMonths(month, 1)), 'yyyy-MM-dd');
			try {
				const result = await fetchAssetDayCounts(
					rangeStart,
					rangeEnd,
					gpsFilter,
					hiddenFilter,
					selectedAlbumID ?? undefined,
					{signal}
				);
				if (!signal.aborted) {
					setCounts(result);
				}
			} catch {
				// ignore aborted requests
			}
		},
		[gpsFilter, hiddenFilter, selectedAlbumID]
	);

	useEffect(() => {
		if (!open) {
			return;
		}
		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;
		void fetchCounts(visibleMonth, controller.signal);
		return () => {
			controller.abort();
		};
	}, [visibleMonth, open, fetchCounts]);

	return counts;
}

function resolveCountOpacity(hasCount: boolean, isHighlighted: boolean): string {
	if (!hasCount) {
		return 'opacity-0';
	}
	if (isHighlighted) {
		return 'opacity-80';
	}
	return 'opacity-60';
}

function CountDayButton({
	className: _className, // eslint-disable-line @typescript-eslint/no-unused-vars -- destructured to exclude from rest props
	day,
	modifiers,
	count,
	...props
}: ComponentProps<typeof DayButton> & {count?: number}): ReactElement {
	const hasCount = count !== undefined && count > 0;
	const isHighlighted = modifiers.selected || modifiers.range_start || modifiers.range_end;
	const countOpacity = resolveCountOpacity(hasCount, isHighlighted);
	return (
		<button
			className={cn(
				'flex h-full w-full flex-col items-center justify-center rounded-md text-[0.8125rem] font-normal transition-colors',
				'hover:bg-(--accent) hover:text-(--accent-foreground)',
				'aria-selected:opacity-100',
				modifiers.selected &&
					'bg-(--primary) text-(--primary-foreground) hover:bg-(--primary) hover:text-(--primary-foreground)',
				modifiers.range_middle &&
					'rounded-none bg-(--accent) text-(--accent-foreground) hover:bg-(--accent) hover:text-(--accent-foreground)',
				modifiers.range_start &&
					'rounded-r-none rounded-l-md bg-(--primary) text-(--primary-foreground) hover:bg-(--primary) hover:text-(--primary-foreground)',
				modifiers.range_end &&
					'rounded-l-none rounded-r-md bg-(--primary) text-(--primary-foreground) hover:bg-(--primary) hover:text-(--primary-foreground)',
				modifiers.today && !modifiers.selected && 'bg-(--accent) text-(--accent-foreground)',
				modifiers.outside && 'text-(--muted-foreground)/40',
				modifiers.disabled && 'text-(--muted-foreground) opacity-50'
			)}
			{...props}>
			<span className={'leading-none'}>{day.date.getDate()}</span>
			<span className={cn('mt-0.5 text-[0.5625rem] leading-none tabular-nums', countOpacity)}>
				{hasCount && count}
				{!hasCount && '0'}
			</span>
		</button>
	);
}

/* eslint-disable @typescript-eslint/naming-convention -- react-day-picker API uses snake_case */
const calendarClassNames = {
	root: 'w-full',
	months: 'w-full',
	month: 'w-full',
	month_caption: 'flex items-center justify-center py-1.5',
	month_grid: 'w-full border-collapse',
	weekdays: 'flex w-full',
	weekday: 'flex-1 pb-2 text-center text-[0.6875rem] font-medium text-(--muted-foreground)',
	week: 'flex w-full',
	day: 'flex-1 aspect-square p-0.5',
	nav: 'absolute inset-x-1 top-1.5 flex items-center justify-between'
};
/* eslint-enable @typescript-eslint/naming-convention */

export function DateRangeFilterGroup({
	startDate,
	endDate,
	onDateRangeAction
}: TDateRangeFilterGroupProps): ReactElement {
	const [isOpen, setIsOpen] = useState(false);
	const [visibleMonth, setVisibleMonth] = useState<Date>(() => {
		if (startDate) {
			return startOfMonth(parseISO(startDate));
		}
		return startOfMonth(new Date());
	});
	const presets = buildPresets();
	const hasFilter = startDate !== null || endDate !== null;
	const hasPresetMatch = presets.some(p => matchesPreset(p, startDate, endDate));
	const dayCounts = useDayCounts(visibleMonth, isOpen);
	let defaultMonth: Date | undefined;
	if (startDate) {
		defaultMonth = parseISO(startDate);
	}

	function handleCalendarSelect(range: DateRange | undefined): void {
		if (!range) {
			onDateRangeAction(null, null);
			return;
		}
		let from: string | null = null;
		let to: string | null = null;
		if (range.from) {
			from = format(range.from, 'yyyy-MM-dd');
		}
		if (range.to) {
			to = format(range.to, 'yyyy-MM-dd');
		}
		onDateRangeAction(from, to);
	}

	return (
		<div className={'flex-1 rounded-lg bg-(--color-bg) p-2.5'}>
			<div className={'mb-1 flex items-center justify-between'}>
				<div
					className={
						'text-[0.5625rem] font-semibold uppercase tracking-[0.08em] text-(--color-text-secondary)'
					}>
					{'Date Range'}
				</div>
				{hasFilter && (
					<button
						onClick={() => {
							onDateRangeAction(null, null);
							setIsOpen(false);
						}}
						className={
							'cursor-pointer border-0 bg-transparent text-[0.5625rem] font-medium text-(--color-primary) hover:underline'
						}>
						{'Clear'}
					</button>
				)}
			</div>
			<Popover
				open={isOpen}
				onOpenChange={setIsOpen}>
				<PopoverTrigger asChild>
					<button
						className={cn(
							buttonBase,
							'mb-1.5 flex items-center gap-1',
							resolveCustomButtonStyle(isOpen, hasFilter, hasPresetMatch)
						)}>
						<CalendarIcon className={'h-3 w-3'} />
						{formatRangeLabel(startDate, endDate)}
					</button>
				</PopoverTrigger>
				<PopoverContent
					className={'w-72 p-0'}
					align={'start'}
					sideOffset={6}>
					<Calendar
						className={'w-full p-3'}
						classNames={calendarClassNames}
						mode={'range'}
						captionLayout={'dropdown'}
						defaultMonth={defaultMonth}
						month={visibleMonth}
						onMonthChange={setVisibleMonth}
						selected={isoToDateRange(startDate, endDate)}
						onSelect={handleCalendarSelect}
						numberOfMonths={1}
						startMonth={new Date(2000, 0)}
						endMonth={new Date()}
						components={{
							DayButton: dayButtonProps => {
								const dateKey = format(dayButtonProps.day.date, 'yyyy-MM-dd');
								return (
									<CountDayButton
										{...dayButtonProps}
										count={dayCounts[dateKey]}
									/>
								);
							}
						}}
					/>
				</PopoverContent>
			</Popover>
			<div className={'flex flex-wrap items-center gap-1.5'}>
				{presets.map(preset => {
					const isActive = matchesPreset(preset, startDate, endDate);
					const stateStyle = resolvePresetButtonStyle(isActive);
					return (
						<button
							key={preset.label}
							onClick={() => onDateRangeAction(preset.startDate, preset.endDate)}
							disabled={isActive}
							className={cn(buttonBase, stateStyle)}>
							{preset.label}
						</button>
					);
				})}
			</div>
		</div>
	);
}
