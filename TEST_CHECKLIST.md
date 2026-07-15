# V3.0.1 Test Checklist

## Before deployment
- Export the `expenses` table as CSV.
- Confirm `gnaguy.lee@gmail.com` is the correct account.
- Run `SUPABASE_SETUP.sql` successfully.

## Duplicate migration
- Confirm existing exact duplicates become one visible record.
- Confirm duplicate rows remain in Supabase only as `deleted = true` tombstones.
- Confirm refreshing the app does not recreate duplicates.
- Confirm reconnecting after offline use does not recreate duplicates.

## Offline-first
- Go offline and add a record; it appears immediately.
- Edit the offline record; its UUID remains unchanged.
- Delete the offline record; it disappears locally.
- Reconnect; all three operations reach Supabase once.

## Conflict and locking
- Trigger refresh, focus and online events close together; only one sync executes.
- Open the PWA twice and confirm repeated sync does not multiply records.
- Repeat manual sync several times; record counts remain stable.

## Duplicate prevention
- Try to add the same date, amount, category and note twice.
- Confirm the second save is blocked with “这笔记录已经存在”.
- Confirm the database unique index blocks an active exact duplicate from another client.

## Regression
- Current cycle, natural month and natural year totals remain correct.
- Edit, delete and CSV export still work.
- Google sign-in persists after refresh.
- Wrong Google accounts are rejected.
