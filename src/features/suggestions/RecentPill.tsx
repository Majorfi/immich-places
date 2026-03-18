'use client';

import {useEffect, useState} from 'react';

import {
	getHistoryStorage,
	parseHistoryCoordinates,
	readHistoryFromStorage,
	recentHistoryDisplayName
} from '@/features/search/searchHistory';
import {ChevronIcon} from '@/features/suggestions/ChevronIcon';
import {PANEL_FADE_IN_ANIMATION} from '@/features/suggestions/constant';
import {itemClass, panelClass, pillClass} from '@/features/suggestions/useSuggestionState';
import {StarIcon, resolveStarColorClass} from '@/shared/components/StarIcon';
import {useSelection} from '@/shared/context/AppContext';
import {MAP_LOCATION_SOURCE_SEARCH} from '@/utils/map';
import {SUGGESTION_PANEL_MAX_ITEMS} from '@/utils/suggestions';

import type {TFavoriteState} from '@/features/suggestions/useFavoriteState';
import type {THistoryEntry} from '@/shared/types/search';
import type {KeyboardEvent, ReactElement} from 'react';

function handleActivate(callback: () => void) {
	return (event: KeyboardEvent) => {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			callback();
		}
	};
}

function loadHistory(): THistoryEntry[] {
	return readHistoryFromStorage(getHistoryStorage());
}

function useRecentHistory(isExpanded: boolean): THistoryEntry[] {
	const [history, setHistory] = useState(loadHistory);

	useEffect(() => {
		if (isExpanded) {
			setHistory(loadHistory());
		}
	}, [isExpanded]);

	return history;
}

export function RecentPill({favoriteState}: {favoriteState: TFavoriteState}): ReactElement | null {
	const {setLocationAction} = useSelection();
	const [isExpanded, setIsExpanded] = useState(false);
	const history = useRecentHistory(isExpanded);
	const {isFavorited, toggleFavorite} = favoriteState;

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
				<ChevronIcon open={isExpanded} />
			</button>
			{isExpanded && (
				<div
					className={panelClass}
					style={{animation: PANEL_FADE_IN_ANIMATION}}>
					<div className={'p-1'}>
						{history.slice(0, SUGGESTION_PANEL_MAX_ITEMS).map(entry => {
							const coordinates = parseHistoryCoordinates(entry);
							let isStarred = false;
							if (coordinates) {
								isStarred = isFavorited(coordinates.latitude, coordinates.longitude);
							}
							return (
								<div
									key={`${entry.lat}:${entry.lon}:${entry.displayName}`}
									role={'button'}
									tabIndex={0}
									onClick={() => {
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
									onKeyDown={handleActivate(() => {
										if (!coordinates) {
											return;
										}
										setLocationAction({
											latitude: coordinates.latitude,
											longitude: coordinates.longitude,
											source: MAP_LOCATION_SOURCE_SEARCH
										});
										setIsExpanded(false);
									})}
									className={itemClass}>
									<span className={'flex items-center gap-2'}>
										<span className={'h-1.5 w-1.5 rounded-full bg-gray-400'} />
										<span className={'max-w-60 truncate'}>{recentHistoryDisplayName(entry)}</span>
									</span>
									{coordinates && (
										<button
											type={'button'}
											onClick={event => {
												event.stopPropagation();
												toggleFavorite(
													coordinates.latitude,
													coordinates.longitude,
													recentHistoryDisplayName(entry)
												);
											}}
											className={`ml-2 flex-shrink-0 ${resolveStarColorClass(isStarred)}`}>
											<StarIcon
												filled={isStarred}
												size={13}
											/>
										</button>
									)}
								</div>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
}
