'use client';

import {getHistoryStorage, saveSearchResultToHistory} from '@/features/search/searchHistory';
import {usePlaceSearch} from '@/features/search/usePlaceSearch';
import {StarIcon, resolveStarColorClass} from '@/shared/components/StarIcon';
import {useSelection} from '@/shared/context/AppContext';
import {parseCoordinatePair} from '@/utils/coordinates';
import {MAP_LOCATION_SOURCE_SEARCH} from '@/utils/map';

import type {TFavoriteState} from '@/features/suggestions/useFavoriteState';
import type {ReactElement} from 'react';

export function PlaceSearch({favoriteState}: {favoriteState: TFavoriteState}): ReactElement {
	const {setLocationAction} = useSelection();
	const {isFavorited, toggleFavorite} = favoriteState;
	const {query, results, error, isOpen, isSearching, wrapperRef, setQuery, handleChange, handleSelect, handleFocus} =
		usePlaceSearch({
			onLocationSelectedAction(latitude: number, longitude: number) {
				setLocationAction({latitude, longitude, source: MAP_LOCATION_SOURCE_SEARCH});
			},
			onResultSelectedAction(result) {
				setQuery(result.displayName.split(',').slice(0, 2).join(',').trim());
			},
			onResultPersistedAction(result) {
				saveSearchResultToHistory(result, getHistoryStorage());
			}
		});
	let spinnerPositionClass = 'right-3';
	if (query) {
		spinnerPositionClass = 'right-11';
	}

	return (
		<div
			className={'relative'}
			ref={wrapperRef}>
			<input
				className={
					'box-border w-full rounded-lg border border-white/60 bg-white/80 px-4 py-2.5 text-[0.875rem] text-(--color-text) shadow-sm outline-none backdrop-blur-md transition-all duration-200 placeholder:text-(--color-text-secondary)/50 hover:bg-white/90 hover:shadow-md focus:bg-white focus:shadow-md'
				}
				type={'text'}
				placeholder={'Search location...'}
				value={query}
				onChange={e => handleChange(e.target.value)}
				onFocus={handleFocus}
			/>
			{query && (
				<button
					type={'button'}
					aria-label={'Clear search'}
					onMouseDown={event => event.preventDefault()}
					onClick={() => handleChange('')}
					className={
						'absolute top-1/2 right-2.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-base text-(--color-text-secondary)'
					}>
					<span aria-hidden={'true'}>{'×'}</span>
				</button>
			)}
			{isSearching && (
				<div
					className={`absolute top-1/2 ${spinnerPositionClass} size-3.5 -translate-y-1/2 rounded-full border-2 border-gray-200 border-t-(--color-text-secondary) animate-[placeSearchSpin_0.6s_linear_infinite]`}
				/>
			)}
			{isOpen && results.length > 0 && (
				<ul
					className={
						'absolute top-[calc(100%+6px)] right-0 left-0 z-1000 m-0 max-h-60 list-none overflow-y-auto rounded-lg border border-white/50 bg-white/75 p-1 shadow-lg backdrop-blur-xl'
					}
					style={{animation: 'fadeInMenu 150ms ease-out'}}>
					{results.map(result => {
						const coordinates = parseCoordinatePair(result.lat, result.lon);
						let isStarred = false;
						if (coordinates) {
							isStarred = isFavorited(coordinates.latitude, coordinates.longitude);
						}
						return (
							<li
								key={result.placeID}
								className={
									'flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-[0.8125rem] leading-[1.3] transition-colors duration-100 hover:bg-white/80'
								}
								onClick={() => handleSelect(result)}>
								<span className={'min-w-0 flex-1 truncate'}>{result.displayName}</span>
								{coordinates && (
									<button
										type={'button'}
										onClick={event => {
											event.stopPropagation();
											toggleFavorite(
												coordinates.latitude,
												coordinates.longitude,
												result.displayName.split(',').slice(0, 2).join(',').trim()
											);
										}}
										className={`ml-2 flex-shrink-0 ${resolveStarColorClass(isStarred)}`}>
										<StarIcon filled={isStarred} />
									</button>
								)}
							</li>
						);
					})}
				</ul>
			)}
			{error && (
				<p
					className={
						'mt-1 rounded-md bg-white/75 px-2 py-1 text-[11px] text-[#b91c1c] shadow-sm backdrop-blur-sm'
					}>
					{error}
				</p>
			)}
		</div>
	);
}
