'use client';

import {FavoritePill} from '@/features/suggestions/FavoritePill';
import {RecentPill} from '@/features/suggestions/RecentPill';
import {SuggestionsPill} from '@/features/suggestions/SuggestionsPill';
import {useCatalog} from '@/shared/context/AppContext';

import type {TFavoriteState} from '@/features/suggestions/useFavoriteState';
import type {ReactElement} from 'react';

export function SuggestionPanel({favoriteState}: {favoriteState: TFavoriteState}): ReactElement {
	const {suggestionsError} = useCatalog();

	return (
		<div className={'mt-2'}>
			<div className={'flex items-start gap-2'}>
				<SuggestionsPill />
				<FavoritePill favoriteState={favoriteState} />
				<RecentPill favoriteState={favoriteState} />
			</div>
			{suggestionsError && (
				<p
					className={
						'mt-1 rounded-md bg-white/75 px-2 py-1 text-[11px] text-[#b91c1c] shadow-sm backdrop-blur-sm'
					}>
					{suggestionsError}
				</p>
			)}
		</div>
	);
}
