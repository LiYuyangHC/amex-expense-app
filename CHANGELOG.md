# V3.0.5

- Replaced the Dock CSV action with an annual spending analysis page.
- Added a 12-month spending trend line chart.
- Added category percentages, ranking, progress bars, and category totals.
- Moved CSV export to the analysis page menu.
- Kept the analytics entirely local and offline-capable.
- Updated the PWA cache version.

# V3.0.4

- Removed all hardcoded expense rows and legacy automatic data seeding.
- Added locale-aware currency formatting with thousands separators.
- Added container-aware dynamic font sizing for the three summary totals.
- Updated the PWA cache version.

# V3.0.3

- Removed the content-based Supabase unique index that blocked UUID reconciliation.
- Kept permanent UUID `id` as the only database identity for idempotent upserts.
- Retained app-level duplicate reconciliation and tombstone-first syncing.
- Updated the PWA cache version.

# CHANGELOG

## V3.0.2 — Sync Ordering Hotfix

### Fixed
- Fixed `expenses_owner_content_unique` errors during legacy duplicate reconciliation.
- Changed cloud writes to a two-phase order: tombstones first, active records second.
- Ensured IndexedDB is replaced only after the canonical server state is fetched successfully.
- Bumped the PWA cache name so the corrected sync engine replaces V3.0.1.


## V3.0.1 — Sync Integrity
- Added a single-flight application sync lock.
- Added a single-flight cloud record sync lock.
- Added permanent UUID migration for legacy records.
- Added `dataMigrationVersion = 3` and `legacyImportCompleted` metadata.
- Changed all cloud record writes to idempotent `upsert(..., onConflict: "id")`.
- Added exact duplicate detection using date, amount, category and note.
- Added automatic soft deletion of duplicate local and cloud rows.
- Added a partial unique index to block active exact duplicates in Supabase.
- Added atomic replacement of the local canonical record set after successful sync.
- Bumped IndexedDB schema and Service Worker cache versions.

## V3.0.0 — Cloud Foundation
- Added Google OAuth through Supabase.
- Restricted access to the configured Google account.
- Added local-first cloud synchronization.
- Added soft-delete synchronization.
- Added silent normal sync and failure-only status feedback.
