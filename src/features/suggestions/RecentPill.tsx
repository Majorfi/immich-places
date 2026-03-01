'use client';

import {useEffect, useState} from 'react';

import {
	getHistoryStorage,
	parseHistoryCoordinates,
	readHistoryFromStorage,
	recentHistoryDisplayName
} from '@/features/search/searchHistory';
import {CHEVRON_TRANSITION, PANEL_FADE_IN_ANIMATION} from '@/features/suggestions/constant';
import {itemClass, panelClass, pillClass} from '@/features/suggestions/useSuggestionState';
import {useSelection} from '@/shared/context/AppContext';
import {MAP_LOCATION_SOURCE_SEARCH} from '@/utils/map';
import {SUGGESTION_PANEL_MAX_ITEMS} from '@/utils/suggestions';

import type {THistoryEntry} from '@/shared/types/search';
import type {ReactElement} from 'react';

/**
 * Small chevron icon used by the recent-history dropdown trigger.
 *
 * @param open - Whether panel is expanded.
 * @returns Chevron SVG.
 */
function Chevron({open}: {open: boolean}): ReactElement {
	return (
		<svg
			width={'10'}
			height={'10'}
			viewBox={'0 0 10 10'}
			style={{transform: open ? 'rotate(180deg)' : '', transition: CHEVRON_TRANSITION}}>
			<path
				d={'M2 4l3 3 3-3'}
				stroke={'currentColor'}
				strokeWidth={'1.5'}
				fill={'none'}
				strokeLinecap={'round'}
			/>
		</svg>
	);
}

/**
 * Read recent location history from storage and refresh when opened.
 *
 * @param isExpanded - Dropdown visibility.
 * @returns Parsed and deduplicated recent entries.
 */
function useRecentHistory(isExpanded: boolean): THistoryEntry[] {
	const [history, setHistory] = useState<THistoryEntry[]>([]);

	useEffect(() => {
		setHistory(readHistoryFromStorage(getHistoryStorage()));
	}, []);

	useEffect(() => {
		if (isExpanded) {
			setHistory(readHistoryFromStorage(getHistoryStorage()));
		}
	}, [isExpanded]);

	return history;
}

/**
 * Pill component showing recent search locations and applying selected coordinates.
 *
 * @returns Recent locations dropdown button and panel, or null when history is empty.
 */
export function RecentPill(): ReactElement | null {
	const {setLocationAction} = useSelection();
	const [isExpanded, setIsExpanded] = useState(false);
	const history = useRecentHistory(isExpanded);

	if (history.length === 0) {
		return null;
	}

	return (
		<div className={'relative'}>
			<button
				onClick={() => setIsExpanded(value => !value)}
				className={pillClass}>
				<svg
					width={'12'}
					height={'12'}
					viewBox={'0 0 24 24'}
					fill={'none'}
					stroke={'currentColor'}
					strokeWidth={'2'}
					strokeLinecap={'round'}>
					<circle
						cx={'12'}
						cy={'12'}
						r={'10'}
					/>
					<polyline points={'12 8 12 12 14 14'} />
				</svg>
				{'Recent'}
				<Chevron open={isExpanded} />
			</button>
			{isExpanded && (
				<div
					className={panelClass}
					style={{animation: PANEL_FADE_IN_ANIMATION}}>
					<div className={'p-1'}>
						{history.slice(0, SUGGESTION_PANEL_MAX_ITEMS).map(entry => (
							<button
								key={`${entry.lat}:${entry.lon}:${entry.displayName}`}
								onClick={() => {
									const coordinates = parseHistoryCoordinates(entry);
									if (!coordinates) {
										return;
									}
									setLocationAction({
										latitude: coordinates.latitude,
										longitude: coordinates.longitude,
										source: MAP_LOCATION_SOURCE_SEARCH
									});
									setIsExpanded(false);
								}}
								className={itemClass}>
								<span className={'flex items-center gap-2'}>
									<span className={'h-1.5 w-1.5 rounded-full bg-gray-400'} />
									<span className={'max-w-70 truncate'}>{recentHistoryDisplayName(entry)}</span>
								</span>
							</button>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
