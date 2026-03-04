/**
 * Map configuration constants used by overview map, marker rendering, and controls.
 */
/** Default map viewport center when no explicit bounds exist. */
export const MAP_DEFAULT_CENTER: [number, number] = [46.603, 1.888];
/** Base zoom when opening the map. */
export const MAP_DEFAULT_ZOOM = 5;
/** Zoom used when centering on user's location. */
export const MAP_LOCATE_ME_ZOOM = 14;

/** Debounce applied before synchronizing map bounds updates. */
export const MAP_BOUNDS_DEBOUNCE_MS = 250;
/** Delay before syncing map bounds right after initialization. */
export const MAP_INITIAL_BOUNDS_SYNC_DELAY_MS = 500;
/** Decimal precision used when comparing viewport bounds keys. */
export const MAP_BOUNDS_KEY_DECIMALS = 4;
/** Maximum zoom supported by the tile provider. */
export const MAP_TILE_MAX_ZOOM = 19;
/** Maximum zoom supported by the Esri satellite tile provider. */
export const MAP_SATELLITE_TILE_MAX_ZOOM = 18;

/** Available tile layer modes. */
export type TMapTileLayer = 'street' | 'satellite';

/** Default fit bounds map padding. */
export const MAP_FIT_PADDING: [number, number] = [30, 30];
/** Animation duration in seconds for fly-to transitions. */
export const MAP_FLY_DURATION_SECONDS = 0.7;
/** Max zoom after fitting a cluster at the same GPS spot. */
export const MAP_FIT_SAME_SPOT_MAX_ZOOM = 17;
/** Max zoom when fitting nearby assets around a point. */
export const MAP_FIT_NEARBY_MAX_ZOOM = 18;
/** Fallback max zoom for generic fit logic. */
export const MAP_FIT_DEFAULT_MAX_ZOOM = 19;
/** Spread threshold to detect overlapping coordinates at same spot. */
export const MAP_FIT_SAME_SPOT_SPREAD_THRESHOLD = 0.001;
/** Spread threshold to detect nearby coordinates for grouping. */
export const MAP_FIT_NEARBY_SPREAD_THRESHOLD = 0.01;

/** Zoom required before requesting pending marker search suggestions. */
export const PENDING_MARKER_SEARCH_ZOOM = 16;
/** Zoom required before showing pending marker suggestions from location hints. */
export const PENDING_MARKER_SUGGESTION_ZOOM = 18;
/** Minimum zoom before showing pending markers when no selection exists. */
export const PENDING_MARKER_NO_SELECTION_MIN_ZOOM = 18;
/** Minimum zoom before showing pending markers when selection exists. */
export const PENDING_MARKER_SELECTION_MIN_ZOOM = 13;
/** Z-index offset to ensure pending marker prominence. */
export const PENDING_MARKER_Z_INDEX_OFFSET = 1000;

/** Pixel radius used when clustering nearby overview markers. */
export const OVERVIEW_CLUSTER_MAX_RADIUS = 50;
/** Distance multiplier used for spiderfy layouts when clusters split. */
export const OVERVIEW_CLUSTER_SPIDERFY_DISTANCE_MULTIPLIER = 2;
/** Zoom used when drilling into a cluster. */
export const OVERVIEW_CLUSTER_CLICK_ZOOM = 18;
/** Padding for overview cluster click-to-zoom behavior. */
export const OVERVIEW_CLUSTER_CLICK_PADDING: [number, number] = [30, 30];
/** Spread threshold for markers sharing same position in overview rendering. */
export const OVERVIEW_CLUSTER_SAME_POSITION_SPREAD_THRESHOLD = 0.001;

/** Photo marker size in overview list mode. */
export const MAP_PHOTO_MARKER_SIZE = 48;
/** Marker size used in overview clusters and map overlays. */
export const MAP_OVERVIEW_MARKER_SIZE = 48;
/** Search pin width in pixels. */
export const MAP_SEARCH_PIN_WIDTH = 28;
/** Search pin height in pixels. */
export const MAP_SEARCH_PIN_HEIGHT = 40;

/** Source value for map click location edits. */
export const MAP_LOCATION_SOURCE_MAP_CLICK = 'map-click';
/** Source value for search-driven location edits. */
export const MAP_LOCATION_SOURCE_SEARCH = 'search';
/** Source value for suggestion-driven location edits. */
export const MAP_LOCATION_SOURCE_SUGGESTION = 'suggestion';
/** Source value for drag-and-drop location edits. */
export const MAP_LOCATION_SOURCE_DRAG_DROP = 'drag-drop';
/** Source value for marker drag edits. */
export const MAP_LOCATION_SOURCE_MARKER_DRAG = 'marker-drag';

/** Map overlays z-index baseline. */
export const MAP_OVERLAYS_Z_INDEX = 1000;
/** Map control z-index baseline. */
export const MAP_CONTROL_Z_INDEX = 1001;
/** Primary color used by map markers. */
export const MAP_ICON_PRIMARY_COLOR = '#216142';
/** Primary text color used in map icons. */
export const MAP_ICON_TEXT_COLOR = '#fff';
/** Badge text color used in marker icons. */
export const MAP_ICON_BADGE_TEXT_COLOR = '#fff';
/** Border width used for map icons. */
export const MAP_ICON_BORDER_WIDTH_PX = 2;
/** Badge icon size in pixels. */
export const MAP_ICON_BADGE_SIZE_PX = 18;
/** Font size for map badge text. */
export const MAP_ICON_BADGE_FONT_SIZE_PX = 10;
/** Font weight for map badge text. */
export const MAP_ICON_BADGE_FONT_WEIGHT = 600;
/** Gradient secondary color for map icon rendering. */
export const MAP_ICON_GRADIENT_MID_COLOR = '#216142';
/** Angular offset for marker gradient direction. */
export const MAP_ICON_GRADIENT_ANGLE_DEGS = 145;
/** Control offset from map edge. */
export const MAP_CONTROL_OFFSET_PX = 16;
/** Vertical spacing between control groups in `rem`. */
export const MAP_CONTROL_STACK_GAP_REM = 0.25;
/** Control button size in pixels. */
export const MAP_CONTROL_BUTTON_SIZE_PX = 32;
/** Map overlay width at top placement. */
export const MAP_OVERLAY_TOP_WIDTH = 'min(720px,calc(100%-1rem))';
/** Map overlay width at bottom placement. */
export const MAP_OVERLAY_BOTTOM_WIDTH = 'min(420px,calc(100%-2rem))';
