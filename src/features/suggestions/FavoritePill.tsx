'use client';

import {useCallback, useState} from 'react';

import {ChevronIcon} from '@/features/suggestions/ChevronIcon';
import {PANEL_FADE_IN_ANIMATION, handleActivate} from '@/features/suggestions/constant';
import {FavoriteNameField} from '@/features/suggestions/FavoriteNameField';
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
	const [renamingID, setRenamingID] = useState<number | null>(null);
	const {favorites, toggleFavorite, renameFavorite} = favoriteState;

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
						{favorites.slice(0, SUGGESTION_PANEL_MAX_ITEMS).map(fav => {
							const isRenaming = renamingID === fav.ID;
							return (
								<div
									key={fav.ID}
									role={'button'}
									tabIndex={0}
									onClick={() => {
										if (isRenaming) {
											return;
										}
										selectFavorite(fav.latitude, fav.longitude);
									}}
									onKeyDown={handleActivate(() => {
										if (isRenaming) {
											return;
										}
										selectFavorite(fav.latitude, fav.longitude);
									})}
									className={itemClass}>
									{isRenaming ? (
										<FavoriteNameField
											defaultName={fav.displayName}
											onConfirmAction={name => {
												renameFavorite(fav.ID, name);
												setRenamingID(null);
											}}
											onCancelAction={() => setRenamingID(null)}
										/>
									) : (
										<>
											<span className={'flex min-w-0 items-center gap-2'}>
												<span className={'h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400'} />
												<span className={'max-w-60 truncate'}>{fav.displayName}</span>
											</span>
											<span className={'ml-2 flex flex-shrink-0 items-center gap-1.5'}>
												<button
													type={'button'}
													onClick={event => {
														event.stopPropagation();
														setRenamingID(fav.ID);
													}}
													className={'text-(--color-text-secondary) hover:text-(--color-text)'}
													title={'Rename'}>
													<svg
														width={'13'}
														height={'13'}
														viewBox={'0 0 24 24'}
														fill={'none'}
														stroke={'currentColor'}
														strokeWidth={'2'}
														strokeLinecap={'round'}
														strokeLinejoin={'round'}>
														<path d={'M12 20h9'} />
														<path d={'M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z'} />
													</svg>
												</button>
												<button
													type={'button'}
													onClick={event => {
														event.stopPropagation();
														toggleFavorite(fav.latitude, fav.longitude, fav.displayName);
													}}
													className={'text-amber-500 hover:text-amber-600'}
													title={'Remove from favorites'}>
													<StarIcon
														filled={true}
														size={14}
													/>
												</button>
											</span>
										</>
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
