import L from 'leaflet';

import {
	MAP_ICON_BADGE_OFFSET_PX,
	MAP_ICON_BADGE_PADDING_PX,
	MAP_ICON_DEFAULT_BORDER,
	MAP_ICON_GRADIENT,
	MAP_ICON_SELECTED_BORDER,
	MAP_ICON_SELECTED_SHADOW,
	MAP_ICON_UNSELECTED_SHADOW
} from '@/features/map/constants';
import {thumbnailURL} from '@/utils/backendUrls';
import {
	MAP_ICON_BADGE_FONT_SIZE_PX,
	MAP_ICON_BADGE_FONT_WEIGHT,
	MAP_ICON_BADGE_SIZE_PX,
	MAP_ICON_PRIMARY_COLOR,
	MAP_ICON_TEXT_COLOR,
	MAP_OVERVIEW_MARKER_SIZE,
	MAP_SEARCH_PIN_HEIGHT,
	MAP_SEARCH_PIN_WIDTH
} from '@/utils/map';

const overviewIconCache = new Map<string, L.DivIcon>();

/**
 * Builds a map marker icon for one or more selected photos.
 *
 * @param assetIDs - Asset IDs shown by the marker badge.
 * @returns DivIcon for photo marker.
 */
export function photoIcon(assetIDs: string[]): L.DivIcon {
	const size = MAP_OVERVIEW_MARKER_SIZE;
	const primaryAssetID = assetIDs[0];
	let imageMarkup = '';
	if (primaryAssetID !== undefined) {
		imageMarkup = `<img src="${thumbnailURL(primaryAssetID)}" style="
		        width:100%;
		        height:100%;
		        object-fit:cover;
		        display:block;
		" loading="lazy" />`;
	}
	const badge =
		assetIDs.length > 1
			? `<div style="
		        position:absolute;
		        top:${MAP_ICON_BADGE_OFFSET_PX}px;
	        right:${MAP_ICON_BADGE_OFFSET_PX}px;
	        min-width:${MAP_ICON_BADGE_SIZE_PX}px;
	        height:${MAP_ICON_BADGE_SIZE_PX}px;
	        border-radius:${MAP_ICON_BADGE_SIZE_PX / 2}px;
	        background:${MAP_ICON_PRIMARY_COLOR};
	        color:${MAP_ICON_TEXT_COLOR};
	        font-size:${MAP_ICON_BADGE_FONT_SIZE_PX}px;
	        font-weight:${MAP_ICON_BADGE_FONT_WEIGHT};
	        display:flex;
	        align-items:center;
	        justify-content:center;
	        padding:0 ${MAP_ICON_BADGE_PADDING_PX}px;
	        border:${MAP_ICON_SELECTED_BORDER};
	        z-index:1;
	      ">${assetIDs.length}</div>`
			: '';

	return L.divIcon({
		className: '',
		iconSize: [size, size],
		iconAnchor: [size / 2, size / 2],
		html: `<div style="position:relative;width:${size}px;height:${size}px;">
		      <div style="
		        width:${size}px;
		        height:${size}px;
		        border-radius:50%;
	        border:${MAP_ICON_SELECTED_BORDER};
	        box-shadow:${MAP_ICON_SELECTED_SHADOW};
	        background:${MAP_ICON_GRADIENT};
	        overflow:hidden;
	      ">${imageMarkup}</div>${badge}</div>`
	});
}

/**
 * Builds a search-pin style marker icon for location search results.
 *
 * @returns DivIcon for search marker.
 */
export function searchPinIcon(): L.DivIcon {
	return L.divIcon({
		className: '',
		iconSize: [MAP_SEARCH_PIN_WIDTH, MAP_SEARCH_PIN_HEIGHT],
		iconAnchor: [MAP_SEARCH_PIN_WIDTH / 2, MAP_SEARCH_PIN_HEIGHT],
		html: `<svg width="${MAP_SEARCH_PIN_WIDTH}" height="${MAP_SEARCH_PIN_HEIGHT}" viewBox="0 0 28 40" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.268 21.732 0 14 0z" fill="${MAP_ICON_PRIMARY_COLOR}"/>
					<circle cx="14" cy="14" r="6" fill="${MAP_ICON_TEXT_COLOR}"/>
				</svg>`
	});
}

/**
 * Builds or reuses a cached overview marker with optional selected and greyscale styles.
 *
 * @param immichID - Asset identifier mapped to marker thumbnail.
 * @param isSelected - Whether marker is currently focused.
 * @param greyscale - Whether to apply grayscale filter.
 * @returns Cached or newly generated overview DivIcon.
 */
export function overviewIcon(immichID: string, isSelected: boolean, greyscale: boolean): L.DivIcon {
	const cacheKey = `${immichID}:${isSelected ? 1 : 0}:${greyscale ? 1 : 0}`;
	const cached = overviewIconCache.get(cacheKey);
	if (cached) {
		return cached;
	}

	const size = MAP_OVERVIEW_MARKER_SIZE;
	const border = isSelected ? MAP_ICON_SELECTED_BORDER : MAP_ICON_DEFAULT_BORDER;
	const shadow = isSelected ? MAP_ICON_SELECTED_SHADOW : MAP_ICON_UNSELECTED_SHADOW;
	const filter = greyscale ? 'filter:grayscale(1);' : '';
	const src = thumbnailURL(immichID);

	const icon = L.divIcon({
		className: '',
		iconSize: [size, size],
		iconAnchor: [size / 2, size / 2],
		html: `<div style="
			width:${size}px;
			height:${size}px;
			border-radius:50%;
			border:${border};
			box-shadow:${shadow};
			overflow:hidden;
			${filter}
		"><img src="${src}" style="
			width:100%;
			height:100%;
			object-fit:cover;
			display:block;
		" loading="lazy" /></div>`
	});
	overviewIconCache.set(cacheKey, icon);
	return icon;
}

/**
 * Overview cluster icon size used by map clustering layer.
 */
export const OVERVIEW_CLUSTER_ICON_SIZE = MAP_OVERVIEW_MARKER_SIZE + 4;
