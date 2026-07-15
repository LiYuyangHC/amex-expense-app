# CHANGELOG

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
