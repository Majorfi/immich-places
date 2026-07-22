# Suggestions Feature

The `suggestions` feature provides location suggestions and recently used locations to quickly assign GPS coordinates while working in catalog/map workflows.

## Feature scope

- Build and rank suggestion categories from backend suggestion endpoints.
- Present suggestions as categorized pills with lazy-loading behavior for frequent locations.
- Offer recent-location shortcuts pulled from local storage history.
- Apply a chosen suggestion coordinate to the current selection with correct location source metadata.

## Files

- `useSuggestions.ts`
    - Fetches suggestion clusters from backend.
    - Scores and merges suggestion sources.
    - Builds categorized suggestion groups (suggested, neighbor, album, same-day, two-day, weekly, frequent).
- `useSuggestionState.ts`
    - UI state derivation for suggestion tabs, counts, and frequent-load behavior.
    - Includes visual constants and stable cluster/category helpers.
- `useCatalogSuggestions.ts`
    - Connects selection + view context to catalog suggestions and selected album filtering.
- `SuggestionsPill.tsx`
    - Renders expandable suggestion categories and applies location selection.
- `RecentPill.tsx`
    - Renders recent suggestions from stored history and applies chosen coordinates.
- `SuggestionPanel.tsx`
    - Composes suggestion and recent pills and displays suggestion errors.
- `constant.ts`
    - Feature scoring and UI animation constants.

## Data flow

1. The catalog layer requests suggestions via `useCatalogSuggestions` based on current selection and album context.
2. `useSuggestions` calls the backend and transforms responses into grouped categories and suggestion clusters.
3. `useSuggestionState` composes UI categories, handles first-run lazy loading for frequent clusters, and computes visible counts.
4. `SuggestionsPill` and `RecentPill` render dropdowns and call `setLocationAction` with the selected suggestion coordinates and source enums.

## Notes

- The "Nearby in time" (neighbor) category lists the geolocated photos closest in time to the selected one, as individual points ordered by proximity and labeled with their time distance ("2 min before").
- Frequent-location clusters can be loaded on-demand when the suggestion panel opens.
- Recent locations are read from local storage-backed history and trimmed/validated before rendering.
