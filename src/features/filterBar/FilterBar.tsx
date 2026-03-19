'use client';

import {useState} from 'react';

import {
	FILTER_BAR_TRANSITION_CLASS,
	filterButtonClass,
	optionButtonClass,
	toolButtonClass
} from '@/features/filterBar/constant';
import {DateRangeFilterGroup} from '@/features/filterBar/DateRangeFilterGroup';
import {FilterIcon} from '@/features/filterBar/FilterIcon';
import {GPSFilterGroup} from '@/features/filterBar/GPSFilterGroup';
import {HeaderTitle} from '@/features/filterBar/HeaderTitle';
import {HiddenFilterGroup} from '@/features/filterBar/HiddenFilterGroup';
import {NumericOptionGroup} from '@/features/filterBar/NumericOptionGroup';
import {SettingsIcon} from '@/features/filterBar/SettingsIcon';
import {useScrollHeight} from '@/features/filterBar/useScrollHeight';
import {ViewModeGroup} from '@/features/filterBar/ViewModeGroup';
import {cn} from '@/utils/cn';
import {
	GRID_COLUMN_OPTIONS,
	PAGE_SIZE_ALL,
	PAGE_SIZE_OPTIONS,
	buildVisibleMarkerLimitOptions,
	formatMarkerLimitOption,
	resolveActiveVisibleMarkerLimit
} from '@/utils/view';

import type {TGPSFilter, THiddenFilter} from '@/shared/types/map';
import type {TViewMode} from '@/shared/types/view';
import type {ReactElement} from 'react';

type TFilterBarProps = {
	gpsFilter: TGPSFilter;
	onGPSFilterAction: (filter: TGPSFilter) => void;
	hiddenFilter: THiddenFilter;
	onHiddenFilterAction: (filter: THiddenFilter) => void;
	missingCount: number | null;
	pageSize: number;
	onPageSizeAction: (size: number) => void;
	gridColumns: number;
	onGridColumnsAction: (cols: number) => void;
	visibleMarkerLimit: number;
	visibleMarkerTotalCount: number;
	onVisibleMarkerLimitAction: (limit: number) => void;
	viewMode: TViewMode;
	onViewModeAction: (mode: TViewMode) => void;
	startDate: string | null;
	endDate: string | null;
	onDateRangeAction: (startDate: string | null, endDate: string | null) => void;
	isSyncing: boolean;
	syncError?: string | null;
	onSyncAction: () => Promise<void>;
	albumName?: string | null;
	onBackAction?: () => void;
	trailingAction?: ReactElement;
	hideSettingsOnMobile?: boolean;
};

function formatPageSizeLabel(option: number): string {
	if (option === PAGE_SIZE_ALL) {
		return 'All';
	}
	return String(option);
}

export function FilterBar({
	gpsFilter,
	onGPSFilterAction,
	hiddenFilter,
	onHiddenFilterAction,
	missingCount,
	pageSize,
	onPageSizeAction,
	gridColumns,
	onGridColumnsAction,
	visibleMarkerLimit,
	visibleMarkerTotalCount,
	onVisibleMarkerLimitAction,
	viewMode,
	onViewModeAction,
	startDate,
	endDate,
	onDateRangeAction,
	isSyncing,
	syncError,
	onSyncAction,
	albumName,
	onBackAction,
	trailingAction,
	hideSettingsOnMobile = false
}: TFilterBarProps): ReactElement {
	const [isFilterOpen, setIsFilterOpen] = useState(true);
	const [isSettingsOpen, setIsSettingsOpen] = useState(false);
	const filterPanel = useScrollHeight();
	const settingsPanel = useScrollHeight();
	const visibleMarkerLimitOptions = buildVisibleMarkerLimitOptions(visibleMarkerTotalCount);
	const hasVisibleMarkerLimitOptions = visibleMarkerLimitOptions.length > 0;
	const activeVisibleMarkerLimit = resolveActiveVisibleMarkerLimit(visibleMarkerLimit, visibleMarkerLimitOptions);
	const activeVisibleMarkerLimitIndex = visibleMarkerLimitOptions.indexOf(activeVisibleMarkerLimit);
	const canDecreaseVisibleMarkerLimit = activeVisibleMarkerLimitIndex > 0;
	const canIncreaseVisibleMarkerLimit =
		activeVisibleMarkerLimitIndex >= 0 && activeVisibleMarkerLimitIndex < visibleMarkerLimitOptions.length - 1;
	let decreaseStepLabel = '';
	if (canDecreaseVisibleMarkerLimit) {
		decreaseStepLabel = formatMarkerLimitOption(
			activeVisibleMarkerLimit - visibleMarkerLimitOptions[activeVisibleMarkerLimitIndex - 1]
		);
	}
	let increaseStepLabel = '';
	if (canIncreaseVisibleMarkerLimit) {
		increaseStepLabel = formatMarkerLimitOption(
			visibleMarkerLimitOptions[activeVisibleMarkerLimitIndex + 1] - activeVisibleMarkerLimit
		);
	}
	let markerMaxLabel = '';
	if (hasVisibleMarkerLimitOptions) {
		markerMaxLabel = formatMarkerLimitOption(visibleMarkerLimitOptions[visibleMarkerLimitOptions.length - 1]);
	}
	const markerMaxText = `max: ${markerMaxLabel}`;
	let syncTitle = 'Resync with Immich';
	if (isSyncing) {
		syncTitle = 'Syncing...';
	}
	let hideSettingsClass = '';
	let hidePanelOnMobileClass = '';
	if (hideSettingsOnMobile) {
		hideSettingsClass = 'hidden md:inline-flex';
		hidePanelOnMobileClass = 'hidden md:block';
	}

	let filterPanelMaxHeight = '0px';
	let filterPanelOpacity = 0;
	if (isFilterOpen) {
		filterPanelMaxHeight = `${filterPanel.heightPx}px`;
		filterPanelOpacity = 1;
	}

	let settingsPanelMaxHeight = '0px';
	let settingsPanelOpacity = 0;
	if (isSettingsOpen) {
		settingsPanelMaxHeight = `${settingsPanel.heightPx}px`;
		settingsPanelOpacity = 1;
	}

	const onDecreaseVisibleMarkerLimitAction = (): void => {
		if (!canDecreaseVisibleMarkerLimit) {
			return;
		}
		const nextLimit = visibleMarkerLimitOptions[activeVisibleMarkerLimitIndex - 1];
		onVisibleMarkerLimitAction(nextLimit);
	};

	const onIncreaseVisibleMarkerLimitAction = (): void => {
		if (!canIncreaseVisibleMarkerLimit) {
			return;
		}
		const nextLimit = visibleMarkerLimitOptions[activeVisibleMarkerLimitIndex + 1];
		onVisibleMarkerLimitAction(nextLimit);
	};

	return (
		<div className={'border-b border-(--color-border)'}>
			<div className={'flex items-center gap-2 px-3 py-2'}>
				<div className={'min-w-0 flex-1 overflow-hidden'}>
					<HeaderTitle
						albumName={albumName}
						onBackAction={onBackAction}
					/>
				</div>
				<button
					onClick={() => {
						void onSyncAction();
					}}
					disabled={isSyncing}
					title={syncTitle}
					className={cn(toolButtonClass, hideSettingsClass, 'disabled:cursor-default disabled:opacity-40')}>
					<svg
						width={'12'}
						height={'12'}
						viewBox={'0 0 16 16'}
						fill={'currentColor'}
						className={cn(isSyncing && 'animate-spin')}>
						<path d={'M8 1a7 7 0 0 1 7 7h-1.5A5.5 5.5 0 0 0 8 2.5V1z'} />
						<path d={'M8 15a7 7 0 0 1-7-7h1.5A5.5 5.5 0 0 0 8 13.5V15z'} />
						<path d={'M8 1v2.5L10.5 2 8 1z'} />
						<path d={'M8 15v-2.5L5.5 14 8 15z'} />
					</svg>
				</button>
				<button
					onClick={() => {
						setIsFilterOpen(value => !value);
						setIsSettingsOpen(false);
					}}
					className={cn(
						filterButtonClass,
						hideSettingsClass,
						isFilterOpen && 'bg-(--color-primary) text-white',
						!isFilterOpen && 'bg-(--color-bg) text-(--color-text-secondary) hover:text-(--color-text)'
					)}>
					<FilterIcon />
				</button>
				<button
					onClick={() => {
						setIsSettingsOpen(value => !value);
						setIsFilterOpen(false);
					}}
					className={cn(
						filterButtonClass,
						hideSettingsClass,
						isSettingsOpen && 'bg-(--color-primary) text-white',
						!isSettingsOpen && 'bg-(--color-bg) text-(--color-text-secondary) hover:text-(--color-text)'
					)}>
					<SettingsIcon />
				</button>
				{trailingAction && <div className={'ml-1'}>{trailingAction}</div>}
			</div>
			<div
				className={cn(FILTER_BAR_TRANSITION_CLASS, hidePanelOnMobileClass)}
				style={{maxHeight: filterPanelMaxHeight, opacity: filterPanelOpacity}}>
				<div
					ref={filterPanel.ref}
					className={'flex flex-col gap-1.5 px-3 pb-2.5'}>
					<div className={'flex gap-1.5'}>
						<GPSFilterGroup
							gpsFilter={gpsFilter}
							missingCount={missingCount}
							onGPSFilterAction={onGPSFilterAction}
						/>
						<ViewModeGroup
							viewMode={viewMode}
							onViewModeAction={onViewModeAction}
						/>
					</div>
					<DateRangeFilterGroup
						startDate={startDate}
						endDate={endDate}
						onDateRangeAction={onDateRangeAction}
					/>
				</div>
			</div>
			<div
				className={cn(FILTER_BAR_TRANSITION_CLASS, hidePanelOnMobileClass)}
				style={{maxHeight: settingsPanelMaxHeight, opacity: settingsPanelOpacity}}>
				<div
					ref={settingsPanel.ref}
					className={'flex flex-col gap-1.5 px-3 pb-2.5'}>
					<div className={'flex gap-1.5'}>
						<NumericOptionGroup
							label={'Per Page'}
							value={pageSize}
							options={PAGE_SIZE_OPTIONS}
							onChangeAction={onPageSizeAction}
							formatLabel={formatPageSizeLabel}
						/>
						<NumericOptionGroup
							label={'Grid'}
							value={gridColumns}
							options={GRID_COLUMN_OPTIONS}
							onChangeAction={onGridColumnsAction}
						/>
					</div>
					<div className={'flex gap-1.5'}>
						{hasVisibleMarkerLimitOptions && (
							<div className={'min-w-0 basis-1/2 rounded-lg bg-(--color-bg) p-2.5'}>
								<div className={'mb-1 flex items-center justify-between'}>
									<div
										className={
											'text-[0.5625rem] font-semibold uppercase tracking-[0.08em] text-(--color-text-secondary)'
										}>
										{'Markers'}
									</div>
									<div
										className={
											'ml-2 shrink-0 whitespace-nowrap text-[0.5625rem] text-(--color-text-secondary)'
										}>
										{markerMaxText}
									</div>
								</div>
								<div className={'flex items-center gap-1'}>
									<button
										onClick={onDecreaseVisibleMarkerLimitAction}
										disabled={!canDecreaseVisibleMarkerLimit}
										className={cn(
											optionButtonClass,
											'px-1.5',
											'border-(--color-border) bg-transparent text-(--color-text-secondary) hover:border-(--color-text-secondary)',
											'disabled:cursor-default disabled:opacity-40'
										)}>
										{`-${decreaseStepLabel}`}
									</button>
									<div
										className={
											'min-w-[3.5rem] text-center text-[0.6875rem] font-semibold text-(--color-text)'
										}>
										{formatMarkerLimitOption(activeVisibleMarkerLimit)}
									</div>
									<button
										onClick={onIncreaseVisibleMarkerLimitAction}
										disabled={!canIncreaseVisibleMarkerLimit}
										className={cn(
											optionButtonClass,
											'px-1.5',
											'border-(--color-border) bg-transparent text-(--color-text-secondary) hover:border-(--color-text-secondary)',
											'disabled:cursor-default disabled:opacity-40'
										)}>
										{`+${increaseStepLabel}`}
									</button>
								</div>
							</div>
						)}
						<div
							className={cn(
								'min-w-0',
								hasVisibleMarkerLimitOptions && 'basis-1/2',
								!hasVisibleMarkerLimitOptions && 'flex-1'
							)}>
							<HiddenFilterGroup
								hiddenFilter={hiddenFilter}
								onHiddenFilterAction={onHiddenFilterAction}
							/>
						</div>
					</div>
				</div>
			</div>
			{syncError && <div className={'px-3 pb-2 text-[0.6875rem] text-[#b91c1c]'}>{syncError}</div>}
		</div>
	);
}
