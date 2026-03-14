import L from 'leaflet';

import {
	CLUSTER_ICON_BADGE_BORDER_SIZE_PX,
	CLUSTER_ICON_BADGE_FONT_SIZE_PX,
	CLUSTER_ICON_BADGE_FONT_WEIGHT,
	CLUSTER_ICON_BADGE_OFFSET_PX,
	CLUSTER_ICON_BADGE_PADDING_X_PX,
	CLUSTER_ICON_BADGE_RADIUS_PX,
	CLUSTER_ICON_BADGE_SIZE_PX,
	CLUSTER_ICON_BADGE_TEXT_COLOR,
	CLUSTER_ICON_CONTAINER_STYLE,
	CLUSTER_ICON_GREYSCALE_BADGE_COLOR,
	CLUSTER_ICON_PHOTO_BORDER_COLOR,
	CLUSTER_ICON_PHOTO_SHADOW,
	CLUSTER_ICON_SELECTED_BADGE_COLOR
} from '@/features/map/constant';
import {OVERVIEW_CLUSTER_ICON_SIZE} from '@/features/map/icons';

type TClusterIconArgs = {
	count: number;
	thumbnailSrc: string;
	isGreyscale: boolean;
};

/**
 * Builds the image markup for the cluster marker.
 *
 * @param thumbnailSrc - URL of the asset thumbnail.
 * @returns Safe HTML image string when a source is provided.
 */
function createImageMarkup(thumbnailSrc: string): string {
	if (!thumbnailSrc) {
		return '';
	}
	return `<img src="${thumbnailSrc}" style="width:100%;height:100%;object-fit:cover;display:block;" loading="lazy" />`;
}

/**
 * Builds CSS for the circular marker photo container.
 *
 * @param size - Icon side length in pixels.
 * @param isGreyscale - Whether to apply grayscale filter.
 * @returns Inline CSS declaration list as a semicolon-delimited string.
 */
function createPhotoWrapperStyle(size: number, isGreyscale: boolean): string {
	return [
		`width:${size}px`,
		`height:${size}px`,
		'border-radius:50%',
		`border:${CLUSTER_ICON_BADGE_BORDER_SIZE_PX}px solid ${CLUSTER_ICON_PHOTO_BORDER_COLOR}`,
		`box-shadow:${CLUSTER_ICON_PHOTO_SHADOW}`,
		'overflow:hidden',
		isGreyscale ? 'filter:grayscale(1)' : ''
	]
		.filter(Boolean)
		.join(';');
}

/**
 * Builds CSS for the count badge on top of cluster icon.
 *
 * @param isGreyscale - Whether to use greyscale badge colors.
 * @returns Inline CSS declaration list as a semicolon-delimited string.
 */
function createBadgeStyle(isGreyscale: boolean): string {
	const backgroundColor = isGreyscale ? CLUSTER_ICON_GREYSCALE_BADGE_COLOR : CLUSTER_ICON_SELECTED_BADGE_COLOR;
	return [
		'position:absolute',
		`top:${CLUSTER_ICON_BADGE_OFFSET_PX}px`,
		`right:${CLUSTER_ICON_BADGE_OFFSET_PX}px`,
		`min-width:${CLUSTER_ICON_BADGE_SIZE_PX}px`,
		`height:${CLUSTER_ICON_BADGE_SIZE_PX}px`,
		`border-radius:${CLUSTER_ICON_BADGE_RADIUS_PX}px`,
		`background:${backgroundColor}`,
		`color:${CLUSTER_ICON_BADGE_TEXT_COLOR}`,
		`font-size:${CLUSTER_ICON_BADGE_FONT_SIZE_PX}px`,
		`font-weight:${CLUSTER_ICON_BADGE_FONT_WEIGHT}`,
		'display:flex',
		'align-items:center',
		'justify-content:center',
		`padding:0 ${CLUSTER_ICON_BADGE_PADDING_X_PX}px`,
		`border:${CLUSTER_ICON_BADGE_BORDER_SIZE_PX}px solid ${CLUSTER_ICON_PHOTO_BORDER_COLOR}`,
		'z-index:1'
	].join(';');
}

/**
 * Creates a Leaflet div icon for marker clusters.
 *
 * @param clusterIconArgs - Marker count and rendering metadata.
 * @returns Configured `L.DivIcon` instance for cluster display.
 */
export function createClusterIcon({count, thumbnailSrc, isGreyscale}: TClusterIconArgs): L.DivIcon {
	const size = OVERVIEW_CLUSTER_ICON_SIZE;
	const wrapperStyle = `width:${size}px;height:${size}px;`;
	const photoWrapperStyle = createPhotoWrapperStyle(size, isGreyscale);
	const badgeStyle = createBadgeStyle(isGreyscale);

	return L.divIcon({
		className: '',
		iconSize: [size, size],
		iconAnchor: [size / 2, size / 2],
		html: `<div style="${CLUSTER_ICON_CONTAINER_STYLE}${wrapperStyle}">
			<div style="${photoWrapperStyle}">${createImageMarkup(thumbnailSrc)}</div>
			<div style="${badgeStyle}">${count}</div>
		</div>`
	});
}
