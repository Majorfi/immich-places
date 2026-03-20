'use client';

import {useCallback, useState} from 'react';

import {ChevronIcon} from '@/features/suggestions/ChevronIcon';
import {PANEL_FADE_IN_ANIMATION, handleActivate} from '@/features/suggestions/constant';
import {itemClass, panelClass, pillClass} from '@/features/suggestions/useSuggestionState';
import {StarIcon} from '@/shared/components/StarIcon';
import {useSelection} from '@/shared/context/AppContext';
import {MAP_LOCATION_SOURCE_SEARCH} from '@/utils/map';
import {SUGGESTION_PANEL_MAX_ITEMS} from '@/utils/suggestions';

import type {TFavoriteState} from '@/features/suggestions/useFavoriteState';
import type {ReactElement} from 'react';

export function FavoritePill({favoriteState}: {favoriteState: TFavoriteState}): ReactElement | null {
	const {setLocationAction} = useSelection();
	const [isExpanded, setIsExpanded] = useState(false);
	const {favorites, toggleFavorite} = favoriteState;

	const selectFavorite = useCallback(
		(latitude: number, longitude: number) => {
			setLocationAction({latitude, longitude, source: MAP_LOCATION_SOURCE_SEARCH});
			setIsExpanded(false);
		},
		[setLocationAction]
	);

	if (favorites.length === 0) {
		return null;
	}

	return (
		<div className={'relative'}>
			<button
				onClick={() => setIsExpanded(value => !value)}
				className={pillClass}>
				<StarIcon
					filled={true}
					size={12}
				/>
				{'Favorites'}
				<ChevronIcon open={isExpanded} />
			</button>
			{isExpanded && (
				<div
					className={panelClass}
					style={{animation: PANEL_FADE_IN_ANIMATION}}>
					<div className={'p-1'}>
						{favorites.slice(0, SUGGESTION_PANEL_MAX_ITEMS).map(fav => (
							<div
								key={fav.ID}
								role={'button'}
								tabIndex={0}
								onClick={() => selectFavorite(fav.latitude, fav.longitude)}
								onKeyDown={handleActivate(() => selectFavorite(fav.latitude, fav.longitude))}
								className={itemClass}>
								<span className={'flex items-center gap-2'}>
									<span className={'h-1.5 w-1.5 rounded-full bg-amber-400'} />
									<span className={'max-w-60 truncate'}>{fav.displayName}</span>
								</span>
								<button
									type={'button'}
									onClick={event => {
										event.stopPropagation();
										toggleFavorite(fav.latitude, fav.longitude, fav.displayName);
									}}
									className={'ml-2 text-amber-500 hover:text-amber-600'}
									title={'Remove from favorites'}>
									<StarIcon
										filled={true}
										size={14}
									/>
								</button>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
