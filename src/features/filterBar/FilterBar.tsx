'use client';

import {useState} from 'react';

import {FILTER_BAR_TRANSITION_CLASS, filterButtonClass, toolButtonClass} from '@/features/filterBar/constant';
import {DateRangeFilterGroup} from '@/features/filterBar/DateRangeFilterGroup';
import {FilterIcon} from '@/features/filterBar/FilterIcon';
import {GPSFilterGroup} from '@/features/filterBar/GPSFilterGroup';
import {GPXStatusFilterGroup} from '@/features/filterBar/GPXStatusFilterGroup';
import {HeaderTitle} from '@/features/filterBar/HeaderTitle';
import {SettingsIcon} from '@/features/filterBar/SettingsIcon';
import {SettingsPanel} from '@/features/filterBar/SettingsPanel';
import {TagFilterGroup} from '@/features/filterBar/TagFilterGroup';
import {useScrollHeight} from '@/features/filterBar/useScrollHeight';
import {ViewModeGroup} from '@/features/filterBar/ViewModeGroup';
import {cn} from '@/utils/cn';
import {buildVisibleMarkerLimitOptions, formatMarkerLimitOption, resolveActiveVisibleMarkerLimit} from '@/utils/view';

import type {TGPSFilter, TGPXStatusFilter, THiddenFilter} from '@/shared/types/map';
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
	selectedTagID: string | null;
	onTagAction: (tagID: string | null) => void;
	tagFilterDisabled: boolean;
	isSyncing: boolean;
	syncError?: string | null;
	onSyncAction: () => Promise<void>;
	albumName?: string | null;
	onBackAction?: () => void;
	trailingAction?: ReactElement;
	hideSettingsOnMobile?: boolean;
	isGPXActive?: boolean;
	gpxStatusFilter?: TGPXStatusFilter;
	onGPXStatusFilterAction?: (filter: TGPXStatusFilter) => void;
};

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
	selectedTagID,
	onTagAction,
	tagFilterDisabled,
	isSyncing,
	syncError,
	onSyncAction,
	albumName,
	onBackAction,
	trailingAction,
	hideSettingsOnMobile = false,
	isGPXActive = false,
	gpxStatusFilter,
	onGPXStatusFilterAction
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

	function onDecreaseVisibleMarkerLimitAction(): void {
		if (!canDecreaseVisibleMarkerLimit) {
			return;
		}
		const nextLimit = visibleMarkerLimitOptions[activeVisibleMarkerLimitIndex - 1];
		onVisibleMarkerLimitAction(nextLimit);
	}

	function onIncreaseVisibleMarkerLimitAction(): void {
		if (!canIncreaseVisibleMarkerLimit) {
			return;
		}
		const nextLimit = visibleMarkerLimitOptions[activeVisibleMarkerLimitIndex + 1];
		onVisibleMarkerLimitAction(nextLimit);
	}

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
					{isGPXActive && gpxStatusFilter && onGPXStatusFilterAction && (
						<GPXStatusFilterGroup
							gpxStatusFilter={gpxStatusFilter}
							onGPXStatusFilterAction={onGPXStatusFilterAction}
						/>
					)}
					{!isGPXActive && (
						<>
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
							<TagFilterGroup
								selectedTagID={selectedTagID}
								onTagAction={onTagAction}
								disabled={tagFilterDisabled}
							/>
						</>
					)}
				</div>
			</div>
			<div
				className={cn(FILTER_BAR_TRANSITION_CLASS, hidePanelOnMobileClass)}
				style={{maxHeight: settingsPanelMaxHeight, opacity: settingsPanelOpacity}}>
				<div ref={settingsPanel.ref}>
					<SettingsPanel
						pageSize={pageSize}
						onPageSizeAction={onPageSizeAction}
						gridColumns={gridColumns}
						onGridColumnsAction={onGridColumnsAction}
						hiddenFilter={hiddenFilter}
						onHiddenFilterAction={onHiddenFilterAction}
						activeVisibleMarkerLimit={activeVisibleMarkerLimit}
						hasVisibleMarkerLimitOptions={hasVisibleMarkerLimitOptions}
						canDecreaseVisibleMarkerLimit={canDecreaseVisibleMarkerLimit}
						canIncreaseVisibleMarkerLimit={canIncreaseVisibleMarkerLimit}
						decreaseStepLabel={decreaseStepLabel}
						increaseStepLabel={increaseStepLabel}
						markerMaxText={markerMaxText}
						onDecreaseVisibleMarkerLimitAction={onDecreaseVisibleMarkerLimitAction}
						onIncreaseVisibleMarkerLimitAction={onIncreaseVisibleMarkerLimitAction}
					/>
				</div>
			</div>
			{syncError && <div className={'px-3 pb-2 text-[0.6875rem] text-[#b91c1c]'}>{syncError}</div>}
		</div>
	);
}
