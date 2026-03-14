import {
	MAP_CONTROL_BUTTON_SIZE_PX,
	MAP_CONTROL_OFFSET_PX,
	MAP_CONTROL_STACK_GAP_REM,
	MAP_ICON_BORDER_WIDTH_PX,
	MAP_ICON_GRADIENT_MID_COLOR,
	MAP_ICON_PRIMARY_COLOR
} from '@/utils/map';

export const TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

/**
 * Copyright and attribution text for basemap provider.
 */
export const TILE_ATTRIBUTION =
	'<a href="https://leafletjs.com">Leaflet</a> | &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | &copy; <a href="https://carto.com/">CARTO</a>';

export const SATELLITE_TILE_URL =
	'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

export const SATELLITE_TILE_ATTRIBUTION =
	'<a href="https://leafletjs.com">Leaflet</a> | &copy; Esri, Maxar, Earthstar Geographics';

/** Badge offset for selected map icon overlays. */
export const MAP_ICON_BADGE_OFFSET_PX = -4;
/** Horizontal inner padding used by map icon badges. */
export const MAP_ICON_BADGE_PADDING_PX = 4;
/** Shadow Y offset used for marker icon elevation. */
const MAP_ICON_SHADOW_OFFSET_Y_PX = 2;
/** Blur radius for marker icon drop shadows. */
const MAP_ICON_SHADOW_BLUR_PX = 6;
/** Alpha channel for base marker icon shadow. */
const MAP_ICON_SHADOW_BASE_ALPHA = 0.25;
/** Alpha channel for selected marker icon shadow. */
const MAP_ICON_SELECTED_SHADOW_ALPHA = 0.3;
/** Alpha channel for unselected marker icon shadow. */
const MAP_ICON_UNSELECTED_SHADOW_ALPHA = 0.2;
/** Border CSS for selected map icon state. */
export const MAP_ICON_SELECTED_BORDER = `${MAP_ICON_BORDER_WIDTH_PX}px solid ${MAP_ICON_PRIMARY_COLOR}`;
/** Border CSS for default/unselected map icon state. */
export const MAP_ICON_DEFAULT_BORDER = `${MAP_ICON_BORDER_WIDTH_PX}px solid #fff`;
/** Gradient fill for default map icon fill. */
export const MAP_ICON_GRADIENT = `linear-gradient(145deg, ${MAP_ICON_PRIMARY_COLOR}, ${MAP_ICON_GRADIENT_MID_COLOR})`;
/** Base box shadow style for map icons. */
const MAP_ICON_SHADOW = `0 ${MAP_ICON_SHADOW_OFFSET_Y_PX}px ${MAP_ICON_SHADOW_BLUR_PX}px rgba(0,0,0,${MAP_ICON_SHADOW_BASE_ALPHA})`;
/** Selected state shadow for prominent map icons. */
export const MAP_ICON_SELECTED_SHADOW = `0 0 0 ${MAP_ICON_BORDER_WIDTH_PX}px ${MAP_ICON_PRIMARY_COLOR}, 0 ${MAP_ICON_SHADOW_OFFSET_Y_PX}px ${MAP_ICON_SHADOW_BLUR_PX}px rgba(0,0,0,${MAP_ICON_SELECTED_SHADOW_ALPHA})`;
/** Unselected state shadow for muted map icons. */
export const MAP_ICON_UNSELECTED_SHADOW = `0 ${MAP_ICON_SHADOW_OFFSET_Y_PX}px ${MAP_ICON_SHADOW_BLUR_PX}px rgba(0,0,0,${MAP_ICON_UNSELECTED_SHADOW_ALPHA})`;

/** Negative offset for cluster badge positioning. */
export const CLUSTER_ICON_BADGE_OFFSET_PX = -4;
/** Circular badge size for cluster labels. */
export const CLUSTER_ICON_BADGE_SIZE_PX = 18;
/** Horizontal padding within cluster badge. */
export const CLUSTER_ICON_BADGE_PADDING_X_PX = 4;
/** Default border radius for cluster badge rendering. */
export const CLUSTER_ICON_BADGE_RADIUS_PX = CLUSTER_ICON_BADGE_SIZE_PX / 2;
/** Y offset for cluster icon shadow. */
const CLUSTER_ICON_SHADOW_OFFSET_Y_PX = 2;
/** Blur radius for cluster icon shadow. */
const CLUSTER_ICON_SHADOW_BLUR_PX = 6;
/** Alpha channel used for cluster icon shadow. */
const CLUSTER_ICON_SHADOW_ALPHA = 0.25;
/** Shared container CSS for cluster icon wrapper. */
export const CLUSTER_ICON_CONTAINER_STYLE = 'position:relative;';
/** Border color around photo circle. */
export const CLUSTER_ICON_PHOTO_BORDER_COLOR = '#fff';
/** Text color for cluster count badge. */
export const CLUSTER_ICON_BADGE_TEXT_COLOR = '#fff';
/** Font size for cluster count badge text. */
export const CLUSTER_ICON_BADGE_FONT_SIZE_PX = 10;
/** Font weight used for badge text. */
export const CLUSTER_ICON_BADGE_FONT_WEIGHT = 600;
/** Border thickness of badge container. */
export const CLUSTER_ICON_BADGE_BORDER_SIZE_PX = 2;
/** Selected badge color. */
export const CLUSTER_ICON_SELECTED_BADGE_COLOR = '#216142';
/** Greyscale badge color for non-selected clusters. */
export const CLUSTER_ICON_GREYSCALE_BADGE_COLOR = '#888';
/** Photo shadow for cluster icon thumbnails. */
export const CLUSTER_ICON_PHOTO_SHADOW = `0 ${CLUSTER_ICON_SHADOW_OFFSET_Y_PX}px ${CLUSTER_ICON_SHADOW_BLUR_PX}px rgba(0,0,0,${CLUSTER_ICON_SHADOW_ALPHA})`;

/** Utility class for map control wrappers. */
export const MAP_CONTROL_PANEL_CLASS = 'absolute flex';
/** Utility class for map control buttons. */
export const MAP_CONTROL_BUTTON_CLASS =
	'flex cursor-pointer items-center justify-center rounded-lg border border-white/60 bg-white/80 text-(--color-text-secondary) shadow-sm backdrop-blur-md transition-all duration-200 hover:bg-white hover:text-(--color-text) hover:shadow-md';
/** Shared style object for icon buttons. */
export const MAP_CONTROL_ICON_BUTTON_STYLE = {
	width: `${MAP_CONTROL_BUTTON_SIZE_PX}px`,
	height: `${MAP_CONTROL_BUTTON_SIZE_PX}px`
};
/** CSS offset used to inset map control groups from viewport edges. */
export const MAP_CONTROL_OFFSET = `${MAP_CONTROL_OFFSET_PX}px`;
/** Stack gap in rem units for grouped controls. */
export const MAP_CONTROL_STACK_GAP = `${MAP_CONTROL_STACK_GAP_REM}rem`;

/** Localized text when geolocation API is unavailable. */
export const GEOLOCATION_UNAVAILABLE_ERROR = 'Geolocation is not available in this browser';
/** Localized text when geolocation permission is blocked or denied. */
export const GEOLOCATION_PERMISSION_ERROR = 'Unable to access your location';
