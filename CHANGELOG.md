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
