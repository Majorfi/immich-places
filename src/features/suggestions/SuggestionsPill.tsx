'use client';

import {useState} from 'react';

import {ChevronIcon} from '@/features/suggestions/ChevronIcon';
import {PANEL_FADE_IN_ANIMATION} from '@/features/suggestions/constant';
import {
	categoryColor,
	clusterStableKey,
	itemClass,
	panelClass,
	pillClass,
	resolveMaxItemsForCategory,
	useSuggestionState
} from '@/features/suggestions/useSuggestionState';
import {useCatalog, useSelection} from '@/shared/context/AppContext';
import {MAP_LOCATION_SOURCE_SUGGESTION} from '@/utils/map';

import type {ReactElement} from 'react';

/**
 * Main suggestions pill that opens categorized clusters and applies selected location.
 *
 * It renders category tabs and delegates category-specific clusters to a panel.
 *
 * @returns Suggestion button and optional dropdown panel.
 */
export function SuggestionsPill(): ReactElement {
	const {categories} = useCatalog();
	const {setLocationAction, selectedAssets} = useSelection();
	const [isExpanded, setIsExpanded] = useState(false);
	const [tab, setTab] = useState(0);
	const {allCategories, hasContent, suggestionCount, frequentError, requestFrequentLoad} = useSuggestionState(
		selectedAssets.length,
		categories
	);

	const safeTab = Math.min(tab, Math.max(allCategories.length - 1, 0));
	const activeCategory = hasContent ? allCategories[safeTab] : null;

	/**
	 * Toggles dropdown visibility and primes frequent-location loading when opened.
	 */
	function handleToggleExpand(): void {
		if (!hasContent) {
			return;
		}
		const willExpand = !isExpanded;
		setIsExpanded(willExpand);
		if (willExpand) {
			requestFrequentLoad();
		}
	}

	return (
		<div className={'relative'}>
			<button
				onClick={handleToggleExpand}
				className={`${pillClass}${hasContent ? '' : ' opacity-50'}`}>
				<svg
					width={'13'}
					height={'13'}
					viewBox={'0 0 24 24'}
					fill={'none'}
					stroke={'currentColor'}
					strokeWidth={'2.5'}
					strokeLinecap={'round'}>
					<path d={'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5'} />
				</svg>
				{suggestionCount > 0
					? `${suggestionCount} ${suggestionCount === 1 ? 'suggestion' : 'suggestions'}`
					: 'Suggestions'}
				{hasContent && <ChevronIcon open={isExpanded} />}
			</button>
			{isExpanded && activeCategory && (
				<div
					className={panelClass}
					style={{animation: PANEL_FADE_IN_ANIMATION}}>
					<div className={'flex gap-1 overflow-x-auto border-b border-gray-100/80 p-2'}>
						{allCategories.map((category, index) => (
							<button
								key={category.key}
								onClick={() => setTab(index)}
								className={`shrink-0 whitespace-nowrap cursor-pointer rounded-lg border-0 px-2.5 py-1 text-[11px] font-medium transition-all ${index === safeTab ? 'text-white shadow-sm' : 'bg-transparent text-(--color-text-secondary) hover:bg-gray-100/80'}`}
								style={index === safeTab ? {background: categoryColor(category.key)} : {}}>
								{category.label}
							</button>
						))}
					</div>
					<div className={'p-1'}>
						{activeCategory.clusters
							.slice(0, resolveMaxItemsForCategory(activeCategory.key))
							.map(cluster => (
								<button
									key={clusterStableKey(cluster)}
									onClick={() => {
										setLocationAction({
											latitude: cluster.latitude,
											longitude: cluster.longitude,
											source: MAP_LOCATION_SOURCE_SUGGESTION
										});
										setIsExpanded(false);
									}}
									className={itemClass}>
									<span className={'flex items-center gap-2'}>
										<span
											className={'h-1.5 w-1.5 rounded-full'}
											style={{background: categoryColor(activeCategory.key)}}
										/>
										<span className={'max-w-70 truncate'}>{cluster.label}</span>
									</span>
									<span className={'text-[11px] text-(--color-text-secondary)'}>{cluster.count}</span>
								</button>
							))}
					</div>
					{frequentError && <p className={'px-3 pb-2 text-[11px] text-[#b91c1c]'}>{frequentError}</p>}
				</div>
			)}
		</div>
	);
}
