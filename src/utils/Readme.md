# Shared Utilities

This directory groups reusable, cross-feature utility primitives used throughout the app.

## Purpose

- Centralize low-level helpers (type guards, polling helpers, string and URL helpers).
- Keep runtime constants in a single, discoverable place (map, pagination, search, suggestions, view modes, etc.).
- Provide shared request and backend URL building helpers used by service and hook layers.

## Categories

- `abort.ts`

    - Abort utilities for cancellable async work (`waitForDelay`, `isAbortError`).

- `backendUrls.ts`

    - Backend URL builders for assets and optional Immich deep links.

- `client.ts`

    - Client-side backend base URL resolution.

- `cn.ts`

    - CSS class string joiner utility.

- `dragDrop.ts`

    - Shared constants for drag-and-drop interactions.

- `geocoding.ts`

    - Geocoder service limits and endpoints.

- `history.ts`

    - Place search history retention and precision constants.

- `locationAssignment.ts`

    - Runtime limits for batching and coordinate precision when saving locations.

- `map.ts`

    - Map UX and rendering constants.

- `math.ts`

    - Numeric normalization utilities.

- `pagination.ts`

    - Pagination helpers and page range generation.

- `photoGrid.ts`

    - Layout/animation constants for photo grid rendering.

- `request.ts`

    - HTTP client constants and default request timeout.

- `resync.ts`

    - Sync polling timing values.

- `search.ts`

    - Search debounce constants.

- `string.ts`

    - String input validation helpers.

- `suggestions.ts`

    - Suggestion category definitions, labels and limits.

- `typeGuards.ts`

    - Shared runtime validation helpers used before storing external data in typed state.

- `view.ts`
    - View mode and catalog defaults, URL parameter names, and normalization helpers.

## Usage guidance

Import from specific files directly so features stay explicit about dependencies and avoid hidden coupling. Keep constants immutable and reuse these values instead of re-duplicating magic numbers in UI code.
