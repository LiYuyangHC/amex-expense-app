# V3.0.5 — Annual Spending Analysis

## New
- The right Dock action is now **消费分析** instead of CSV export.
- Added a native iOS-style full-screen annual analytics page.
- Added monthly spending trend visualization for January through December.
- Added annual category percentages, category ranking, progress bars, and totals.

## Changed
- CSV export remains available from the `•••` action in the analytics navigation bar.
- Analytics use the current year's active, non-deleted records and work offline from IndexedDB.

## Maintenance
- Bumped the Service Worker cache to V3.0.5.

# V3.0.4 — Code Cleanup & Adaptive Statistics

## Removed
- Removed all hardcoded expense records from the GitHub codebase.
- Removed the legacy `seedExistingRecordsOnce()` data injection function.
- New browsers and cleared devices no longer create sample or historical expenses automatically.

## Improved
- Added locale-aware USD formatting with thousands separators, for example `$12,345.67`.
- Added runtime font fitting for the three top statistic totals.
- Statistic amounts retain the largest readable iOS-style size and shrink only when needed.
- Recalculates statistic font sizes after rendering and when the viewport changes.

## Maintenance
- Bumped the Service Worker cache to V3.0.4.
