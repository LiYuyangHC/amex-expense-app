# V3.0.2 Release Notes

## Purpose
This hotfix repairs a sync-ordering bug found in V3.0.1 when an offline or legacy local record has the same date, amount, category, and note as an active cloud record but a different UUID.

## Fixed
- Soft-deleted duplicate rows are now uploaded before active rows.
- Active rows are uploaded only after the unique content key has been released.
- A failed cloud write never clears or replaces IndexedDB.
- Normal synchronization remains silent; only an actual failure is surfaced.

## Database
No additional SQL migration is required after the V3.0.1 `SUPABASE_SETUP.sql` has already been run.

## Required test
1. Deploy V3.0.2.
2. Reload the PWA so the new service worker activates.
3. Open Cloud Sync and tap Retry Sync once.
4. Confirm the error disappears and the active cloud table contains no content duplicates.
