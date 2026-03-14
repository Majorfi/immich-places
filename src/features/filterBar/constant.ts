import {GRID_COLUMN_OPTIONS, PAGE_SIZE_OPTIONS} from '@/utils/view';

import type {TGPSFilter, THiddenFilter} from '@/shared/types/map';
import type {TViewMode} from '@/shared/types/view';

export const FILTER_BAR_TRANSITION_CLASS = 'overflow-hidden transition-[max-height,opacity] duration-200 ease-in-out';
export const ALLOWED_PAGE_SIZES = new Set<number>(PAGE_SIZE_OPTIONS);
export const ALLOWED_GRID_COLUMNS = new Set<number>(GRID_COLUMN_OPTIONS);

export const GPS_LABEL: Record<TGPSFilter, string> = {
	'no-gps': 'Missing location',
	'with-gps': 'With location' //eslint-disable-line
};
export const gpsOptions: readonly TGPSFilter[] = ['no-gps', 'with-gps'];
export const VIEW_MODE_LABEL: Record<TViewMode, string> = {timeline: 'Timeline', album: 'Albums'};
export const viewModeOptions: readonly TViewMode[] = ['timeline', 'album'];
export const HIDDEN_LABEL: Record<THiddenFilter, string> = {visible: 'Visible', hidden: 'Hidden', all: 'All'};
export const hiddenOptions: readonly THiddenFilter[] = ['visible', 'hidden', 'all'];

export const toolButtonClass =
	'flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border-0 bg-(--color-bg) text-(--color-text-secondary) transition-all duration-150 hover:text-(--color-text)';
export const filterButtonClass =
	'flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border-0 transition-all duration-150';
export const optionButtonClass =
	'cursor-pointer rounded-md border px-2 py-1 text-[0.6875rem] font-medium transition-all duration-150';
