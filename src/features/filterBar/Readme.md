# Filter Bar Feature

The `filterBar` feature contains the photo browser toolbar used to control catalog view and query state.

## What this feature does

- Synchronizes filter and view state with the URL so the browser state can be shared/restored.
- Provides controls for:
    - GPS coverage filter (`with-gps`, `no-gps`, `all`),
    - page size,
    - grid column count,
    - timeline/album mode toggle,
    - and manual sync with Immich.
- Displays contextual title and sync error information.
- Exposes reusable UI pieces and constants used by the filter area.

## Files in this directory

- `FilterBar.tsx`
    - Main toolbar component.
    - Manages expansion state and composes header, sync button, mode toggle, and option groups.
- `HeaderTitle.tsx`
    - Renders either app title or album-focused back button title.
- `GPSFilterGroup.tsx`
    - Renders GPS filter options and optional badge for missing-location count.
- `useMissingLocationCount.ts`
    - Hook backing that badge; counts assets without coordinates under the active
      album, tag, hidden and date filters.
- `NumericOptionGroup.tsx`
    - Generic number option row used by page-size and grid-column controls.
- `FilterIcon.tsx`
    - Shared icon component for the filter panel toggle.
- `constants.tsx`
    - Shared labels, option lists, mode helpers, icons, and class names.
- `constant.ts`
    - Filter bar-specific numeric constants and allowed-option sets.
- `useURLState.ts`
    - Hook and helpers that bind filter state to URL search params with input validation,
      defaults, and history synchronization.

## State and URL flow

1. `useURLState` reads URL params on mount and subscribes to `popstate`.
2. Incoming query values are sanitized and validated before updating local state.
3. User interactions call update actions to change state.
4. `buildURLFromState` / `syncURLAction` produce and apply compact URLs
   (omitting defaults) for shareable, restorable filter state.
