# photoGrid Feature

The `photoGrid` feature renders the main asset gallery and manages data loading, selection,
and focus behavior for the photos shown on the map/list views.

## What this feature owns

- Fetching and paging asset data for the current filters and album context.
- Rendering cards with selection state, status panels, and card context menus.
- Synchronizing external focus events (for map focus or deep link navigation) into grid
  selection and scroll position.

## Files

- `PhotoGrid.tsx`
    - Composes the visible state panels and tile list.
    - Orchestrates focus hooks and wires selection handlers from global context.
- `PhotoGridStatePanels.tsx`
    - Renders loading, syncing, error, and empty-state UI blocks.
- `PhotoCard.tsx`
    - Displays one tile with thumbnail + selection badge.
    - Handles click and drag interactions for that tile.
- `PhotoCardMenu.tsx`
    - Provides card actions (select, clear/select all, preview, open in Immich).
- `useAssets.ts`
    - Loads assets from API, handles page/filter changes, and supports abortable requests.
- `useFocusedAsset.ts`
    - Hook that reacts to `focusedAssetID` by selecting the relevant tile.
- `constant.ts`
    - Re-exports animation value used by the grid component.

## Data flow

1. `PhotoGrid` gets paged assets and renders `PhotoGridStatePanels` plus the card list.
2. `useAssets` fetches/normalizes page results and tracks loading/error state.
3. `PhotoGrid` renders `PhotoCard` for each asset, passing selection handlers.
4. Focus-related hook from `useFocusedAsset` keeps map-driven focus in sync with grid
   selection.

## Notes

- Selection and focus changes stay local to this feature via shared application context
  hooks.
- The animation constants are intentionally kept thin wrappers around shared utility constants
  to keep feature-level imports predictable.
