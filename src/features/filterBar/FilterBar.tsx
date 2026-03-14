'use client';

import {useEffect, useRef, useState} from 'react';

import {FILTER_BAR_TRANSITION_CLASS} from '@/features/filterBar/constant';
import {filterButtonClass, optionButtonClass, toolButtonClass} from '@/features/filterBar/constant';
import {FilterIcon} from '@/features/filterBar/FilterIcon';
import {GPSFilterGroup} from '@/features/filterBar/GPSFilterGroup';
import {HeaderTitle} from '@/features/filterBar/HeaderTitle';
import {HiddenFilterGroup} from '@/features/filterBar/HiddenFilterGroup';
import {NumericOptionGroup} from '@/features/filterBar/NumericOptionGroup';
import {ViewModeGroup} from '@/features/filterBar/ViewModeGroup';
import {cn} from '@/utils/cn';
import {
	GRID_COLUMN_OPTIONS,
	PAGE_SIZE_OPTIONS,
	buildVisibleMarkerLimitOptions,
	formatMarkerLimitOption,
	resolveActiveVisibleMarkerLimit
} from '@/utils/view';

import type {TGPSFilter, THiddenFilter} from '@/shared/types/map';
import type {TViewMode} from '@/shared/types/view';
import type {ReactElement} from 'react';

/**
 * Props for the main filter bar container.
 */
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
	isSyncing: boolean;
	syncError?: string | null;
	onSyncAction: () => Promise<void>;
	albumName?: string | null;
	onBackAction?: () => void;
	trailingAction?: ReactElement;
	hideSettingsOnMobile?: boolean;
};

/**
 * Renders the top-level filter toolbar and expandable filter controls.
 *
 * Includes:
 * - current title / back button,
 * - sync trigger,
 * - timeline/album mode toggle,
 * - filter expansion state,
 * - and numeric options for paging/grid settings.
 *
 * @param gpsFilter - Current GPS filter selection.
 * @param onGPSFilterAction - Callback to update GPS filter.
 * @param missingCount - Count used for missing-location badge.
 * @param pageSize - Selected page size.
 * @param onPageSizeAction - Callback to update page size.
 * @param gridColumns - Selected grid column count.
 * @param onGridColumnsAction - Callback to update grid columns.
 * @param viewMode - Active view mode.
 * @param onViewModeAction - Callback to switch view mode.
 * @param isSyncing - Whether sync action is in progress.
 * @param syncError - Optional sync error message.
 * @param onSyncAction - Action to trigger remote sync.
 * @param albumName - Optional album label when focused on an album.
 * @param onBackAction - Optional callback to return to default title context.
 * @returns Filter toolbar and controls.
 */
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
	isSyncing,
	syncError,
	onSyncAction,
	albumName,
	onBackAction,
	trailingAction,
	hideSettingsOnMobile = false
}: TFilterBarProps): ReactElement {
	const [isOpen, setIsOpen] = useState(true);
	const [openPanelHeightPx, setOpenPanelHeightPx] = useState(160);
	const panelBodyRef = useRef<HTMLDivElement | null>(null);
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
	const hideSettingsClass = hideSettingsOnMobile ? 'hidden md:inline-flex' : '';
	const hidePanelOnMobileClass = hideSettingsOnMobile ? 'hidden md:block' : '';

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

	useEffect(() => {
		const panelBodyElement = panelBodyRef.current;
		if (!panelBodyElement) {
			return;
		}

		const updatePanelHeight = (): void => {
			setOpenPanelHeightPx(panelBodyElement.scrollHeight);
		};
		updatePanelHeight();

		if (typeof ResizeObserver === 'undefined') {
			window.addEventListener('resize', updatePanelHeight);
			return () => {
				window.removeEventListener('resize', updatePanelHeight);
			};
		}

		const observer = new ResizeObserver(() => {
			updatePanelHeight();
		});
		observer.observe(panelBodyElement);
		return () => {
			observer.disconnect();
		};
	}, []);

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
					title={isSyncing ? 'Syncing...' : 'Resync with Immich'}
					className={cn(toolButtonClass, hideSettingsClass, 'disabled:cursor-default disabled:opacity-40')}>
					<svg
						width={'12'}
						height={'12'}
						viewBox={'0 0 16 16'}
						fill={'currentColor'}
						className={isSyncing ? 'animate-spin' : ''}>
						<path d={'M8 1a7 7 0 0 1 7 7h-1.5A5.5 5.5 0 0 0 8 2.5V1z'} />
						<path d={'M8 15a7 7 0 0 1-7-7h1.5A5.5 5.5 0 0 0 8 13.5V15z'} />
						<path d={'M8 1v2.5L10.5 2 8 1z'} />
						<path d={'M8 15v-2.5L5.5 14 8 15z'} />
					</svg>
				</button>
				<button
					onClick={() => setIsOpen(value => !value)}
					className={cn(
						filterButtonClass,
						hideSettingsClass,
						isOpen && 'bg-(--color-primary) text-white',
						!isOpen && 'bg-(--color-bg) text-(--color-text-secondary) hover:text-(--color-text)'
					)}>
					<FilterIcon />
				</button>
				{trailingAction && <div className={'ml-1'}>{trailingAction}</div>}
			</div>
			<div
				className={cn(FILTER_BAR_TRANSITION_CLASS, hidePanelOnMobileClass)}
				style={{
					maxHeight: isOpen ? `${openPanelHeightPx}px` : '0px',
					opacity: isOpen ? 1 : 0
				}}>
				<div
					ref={panelBodyRef}
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
					<div className={'flex gap-1.5'}>
						<NumericOptionGroup
							label={'Per Page'}
							value={pageSize}
							options={PAGE_SIZE_OPTIONS}
							onChangeAction={onPageSizeAction}
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
						<div className={cn('min-w-0', hasVisibleMarkerLimitOptions ? 'basis-1/2' : 'flex-1')}>
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
